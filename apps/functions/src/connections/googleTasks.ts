import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { defineSecret, defineString } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import { authenticateBearer } from '../chat/auth';
import { firestore } from '../chat/firebase';
import { setCorsHeaders } from '../http/cors';
import { verifyAppCheckHeader } from '../http/appCheck';
import { createTask, deleteTask, ensureSuiTaskList, fetchTasks, patchTask, TasksApiError } from './tasksApi';
import { fingerprintTaskBody, toGoogleTaskBody, toMirrorSource } from './taskMirrorMapper';

/**
 * Google Tasks: OAuth, sincronización de lectura y espejo de metas/hábitos.
 *
 * Autocontenido a propósito, como `googleCalendar.ts`. Extraer el OAuth a un
 * módulo compartido obligaría a tocar Calendar, y el riesgo de esa conexión ya
 * en producción pesa más que la duplicación de estas funciones. Cuando Calendar
 * necesite un tercer proveedor, ahí sí conviene factorizar.
 *
 * Lo propio de Tasks frente a Calendar: la API no empuja nada (sólo polling) y
 * el espejo no exige fecha. El refresh token vive únicamente en Firestore; el
 * cliente nunca lo ve.
 */

const GOOGLE_OAUTH_CLIENT_IDS = defineString('GOOGLE_OAUTH_CLIENT_IDS', { default: '' });
const GOOGLE_OAUTH_WEB_CLIENT_ID = defineString('GOOGLE_OAUTH_WEB_CLIENT_ID', { default: '' });
const GOOGLE_OAUTH_WEB_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_WEB_CLIENT_SECRET');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';

const functionOptions = {
  secrets: [GOOGLE_OAUTH_WEB_CLIENT_SECRET],
  cors: false,
  timeoutSeconds: 30,
  memory: '256MiB' as const,
};

type ConnectionDocument = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  clientId: string;
  scope: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};

type MirrorDoc = {
  taskListId: string;
  googleTaskId: string;
  fingerprint: string;
  suiType: 'goal' | 'habit';
};

const connectionRef = (uid: string) =>
  firestore.collection('users').doc(uid).collection('connections').doc('google_tasks');

const mirrorRef = (uid: string, suiId: string) =>
  firestore.collection('users').doc(uid).collection('tasksMirror').doc(suiId);

const hasTasksScope = (scope: string | undefined): boolean =>
  (scope ?? '').split(' ').some((value) => value.trim() === TASKS_SCOPE);

const allowedClientIds = (): Set<string> =>
  new Set(
    GOOGLE_OAUTH_CLIENT_IDS.value()
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const parseBody = (body: unknown): Record<string, unknown> => {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
};

const validateRequest = async (
  request: Parameters<typeof setCorsHeaders>[0],
  response: Parameters<typeof setCorsHeaders>[1],
  method: 'GET' | 'POST',
  operation: string,
): Promise<string | null> => {
  if (!setCorsHeaders(request, response)) {
    response.status(403).json({ error: 'Origin not allowed' });
    return null;
  }
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return null;
  }
  if (request.method !== method) {
    response.status(405).json({ error: 'Method not allowed' });
    return null;
  }
  const appCheckOk = await verifyAppCheckHeader(
    typeof request.headers['x-firebase-appcheck'] === 'string'
      ? request.headers['x-firebase-appcheck']
      : undefined,
    operation,
  );
  if (!appCheckOk) {
    response.status(401).json({ error: 'Invalid App Check token' });
    return null;
  }
  const authentication = await authenticateBearer(
    typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
  );
  if (!authentication.ok) {
    response.status(401).json({ error: 'Invalid authentication' });
    return null;
  }
  return authentication.uid;
};

const exchangeToken = async (params: URLSearchParams): Promise<TokenResponse> => {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const body = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || !body.access_token) throw new Error(body.error || 'oauth_exchange_failed');
  return body;
};

const refreshAccessToken = async (
  document: ConnectionDocument,
  ref: FirebaseFirestore.DocumentReference,
): Promise<ConnectionDocument> => {
  if (!document.refreshToken) throw new Error('reconnect_required');
  const params = new URLSearchParams({
    client_id: document.clientId,
    refresh_token: document.refreshToken,
    grant_type: 'refresh_token',
  });
  if (document.clientId === GOOGLE_OAUTH_WEB_CLIENT_ID.value()) {
    params.set('client_secret', GOOGLE_OAUTH_WEB_CLIENT_SECRET.value());
  }
  const token = await exchangeToken(params);
  const refreshed: ConnectionDocument = {
    ...document,
    accessToken: token.access_token ?? '',
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    scope: token.scope ?? document.scope,
  };
  await ref.set({ ...refreshed, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return refreshed;
};

/** Devuelve la conexión con token fresco, o falla pidiendo reconexión. */
const getActiveConnection = async (uid: string): Promise<ConnectionDocument> => {
  const ref = connectionRef(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error('not_connected');
  const connection = snapshot.data() as ConnectionDocument;
  // Margen de 60s: un token que vence durante el vuelo no sirve.
  if (connection.expiresAt <= Date.now() + 60_000) return refreshAccessToken(connection, ref);
  return connection;
};

const readSuiEntity = async (
  uid: string,
  suiType: 'goal' | 'habit',
  suiId: string,
): Promise<Record<string, unknown> | null> => {
  const collection = suiType === 'goal' ? 'goals' : 'habits';
  const snapshot = await firestore.collection('users').doc(uid).collection(collection).doc(suiId).get();
  if (!snapshot.exists) return null;
  const stored = snapshot.data() as { data?: unknown } | undefined;
  if (!stored || typeof stored.data !== 'object' || stored.data === null) return null;
  return stored.data as Record<string, unknown>;
};

const describeError = (error: unknown): { status: number; message: string } => {
  if (error instanceof TasksApiError) {
    if (error.code === 'reconnect_required') return { status: 401, message: 'Reconnect Google Tasks' };
    if (error.code === 'rate_limited') return { status: 429, message: 'Tasks rate limited' };
  }
  const code = error instanceof Error ? error.message : '';
  if (code === 'not_connected' || code === 'reconnect_required') {
    return { status: 401, message: 'Reconnect Google Tasks' };
  }
  if (code === 'mirror_disabled' || code === 'invalid_mirror_request') return { status: 400, message: code };
  return { status: 502, message: 'Tasks sync failed' };
};

/**
 * Revoca en Google y borra la conexión. La usa `deleteAccount`, igual que la
 * de Calendar: sin esto quedaría acceso vivo a los datos de quien borró su
 * cuenta, que `PRD.md:233` prohíbe explícitamente.
 */
export const disconnectGoogleTasksForUser = async (uid: string): Promise<void> => {
  const ref = connectionRef(uid);
  const snapshot = await ref.get();
  const connection = snapshot.data() as ConnectionDocument | undefined;
  if (connection) {
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: connection.refreshToken ?? connection.accessToken }).toString(),
    }).catch(() => undefined);
  }
  await ref.delete();
};

export const googleTasksConnect = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, 'POST', 'googleTasksConnect');
  if (!uid) return;
  try {
    const body = parseBody(request.body);
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const codeVerifier = typeof body.codeVerifier === 'string' ? body.codeVerifier.trim() : '';
    const redirectUri = typeof body.redirectUri === 'string' ? body.redirectUri.trim() : '';
    const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
    if (!code || !codeVerifier || !redirectUri) {
      response.status(400).json({ error: 'Invalid OAuth request' });
      return;
    }
    if (!allowedClientIds().has(clientId)) {
      // Mismo caso que Calendar: GOOGLE_OAUTH_CLIENT_IDS vacío en el entorno.
      logger.warn('googleTasksConnect rejected client', { operation: 'googleTasksConnect' });
      response.status(400).json({ error: 'OAuth client not allowed' });
      return;
    }
    const params = new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    if (clientId === GOOGLE_OAUTH_WEB_CLIENT_ID.value()) {
      params.set('client_secret', GOOGLE_OAUTH_WEB_CLIENT_SECRET.value());
    }
    const token = await exchangeToken(params);
    if (!hasTasksScope(token.scope)) {
      response.status(403).json({ error: 'Tasks permission missing' });
      return;
    }
    const ref = connectionRef(uid);
    const previous = await ref.get();
    const previousRefreshToken = previous.data()?.refreshToken as string | undefined;
    await ref.set({
      provider: 'google_tasks',
      accessToken: token.access_token,
      // Google no devuelve refresh token en cada canje: sin este fallback un
      // reconectar deja la conexión sin renovación.
      refreshToken: token.refresh_token ?? previousRefreshToken,
      expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
      clientId,
      scope: token.scope,
      updatedAt: FieldValue.serverTimestamp(),
    });
    response.status(200).json({ connected: true });
  } catch (error) {
    logger.error('googleTasksConnect failed', {
      errorMsg: error instanceof Error ? error.message : String(error),
    });
    response.status(502).json({ error: 'Google Tasks authorization failed' });
  }
});

export const googleTasksStatus = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, 'GET', 'googleTasksStatus');
  if (!uid) return;
  response.status(200).json({ connected: (await connectionRef(uid).get()).exists });
});

export const googleTasksSync = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, 'POST', 'googleTasksSync');
  if (!uid) return;
  try {
    const connection = await getActiveConnection(uid);
    const taskListId = await ensureSuiTaskList(connection.accessToken);
    // Sin `updatedMin`: la API de Tasks no empuja nada y el polling completo
    // del tasklist dedicado entra de sobra en la cuota de cortesía.
    const tasks = await fetchTasks(connection.accessToken, taskListId, { showCompleted: true });
    response.status(200).json({ tasks, syncedAt: Date.now() });
  } catch (error) {
    const { status, message } = describeError(error);
    response.status(status).json({ error: message });
  }
});

export const googleTasksDisconnect = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, 'POST', 'googleTasksDisconnect');
  if (!uid) return;
  await disconnectGoogleTasksForUser(uid);
  response.status(200).json({ connected: false });
});

/**
 * Espeja un Goal/Habit Sui en el tasklist dedicado "Sui".
 * Lee la entidad desde Firestore (fuente de verdad), no confía en el cliente.
 * Idempotente por fingerprint: si nada cambió, no hace PATCH.
 */
export const googleTasksMirrorUpsert = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, 'POST', 'googleTasksMirrorUpsert');
  if (!uid) return;
  try {
    const body = parseBody(request.body);
    const suiId = typeof body.suiId === 'string' ? body.suiId.trim() : '';
    const suiType = body.suiType === 'goal' || body.suiType === 'habit' ? body.suiType : null;
    if (!suiId || !suiType) throw new Error('invalid_mirror_request');

    const connection = await getActiveConnection(uid);
    if (!hasTasksScope(connection.scope)) throw new Error('reconnect_required');
    const ref = mirrorRef(uid, suiId);
    const entity = await readSuiEntity(uid, suiType, suiId);

    if (!entity) {
      const existing = (await ref.get()).data() as MirrorDoc | undefined;
      if (existing) {
        await deleteTask(connection.accessToken, existing.taskListId, existing.googleTaskId).catch(
          () => undefined,
        );
        await ref.delete();
      }
      response.status(200).json({ deleted: true });
      return;
    }

    const source = toMirrorSource(suiType, suiId, entity);
    const taskBody = source ? toGoogleTaskBody(source) : null;
    if (!taskBody) throw new Error('mirror_disabled');

    const taskListId = await ensureSuiTaskList(connection.accessToken);
    const fingerprint = fingerprintTaskBody(taskBody);
    const previous = (await ref.get()).data() as MirrorDoc | undefined;
    if (previous && previous.fingerprint === fingerprint && previous.taskListId === taskListId) {
      response.status(200).json({
        googleTaskId: previous.googleTaskId,
        taskListId,
        status: 'mirrored',
        unchanged: true,
      });
      return;
    }

    let googleTaskId = previous?.googleTaskId;
    if (googleTaskId && previous?.taskListId === taskListId) {
      try {
        await patchTask(connection.accessToken, taskListId, googleTaskId, taskBody);
      } catch (error) {
        // La tarea se borró desde Google: se recrea en vez de dejar el espejo
        // apuntando a un id muerto.
        if (error instanceof TasksApiError && error.code === 'not_found') {
          googleTaskId = undefined;
        } else {
          throw error;
        }
      }
    }
    if (!googleTaskId) {
      googleTaskId = (await createTask(connection.accessToken, taskListId, taskBody)).id;
    }
    await ref.set(
      { taskListId, googleTaskId, fingerprint, suiType, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    response.status(200).json({ googleTaskId, taskListId, status: 'mirrored', unchanged: false });
  } catch (error) {
    const { status, message } = describeError(error);
    response.status(status).json({ error: message });
  }
});

/** Elimina el espejo de un item (borra en Tasks si existe + borra el mapeo). */
export const googleTasksMirrorDelete = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, 'POST', 'googleTasksMirrorDelete');
  if (!uid) return;
  try {
    const body = parseBody(request.body);
    const suiId = typeof body.suiId === 'string' ? body.suiId.trim() : '';
    if (!suiId) throw new Error('invalid_mirror_request');
    const connection = await getActiveConnection(uid);
    const ref = mirrorRef(uid, suiId);
    const existing = (await ref.get()).data() as MirrorDoc | undefined;
    if (existing) {
      await deleteTask(connection.accessToken, existing.taskListId, existing.googleTaskId).catch(
        () => undefined,
      );
      await ref.delete();
    }
    response.status(200).json({ deleted: true });
  } catch (error) {
    const { status, message } = describeError(error);
    response.status(status).json({ error: message });
  }
});
