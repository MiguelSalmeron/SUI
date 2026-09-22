import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { defineSecret, defineString } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import { authenticateBearer } from '../chat/auth';
import { firestore } from '../chat/firebase';
import { setCorsHeaders } from '../http/cors';
import { verifyAppCheckHeader } from '../http/appCheck';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  ensureSuiCalendar,
  GoogleApiError,
  patchCalendarEvent,
} from './googleApi';
import { CalendarFetchError, fetchCalendarEvents } from './calendarFetch';
import { resolveMirrorCalendarId } from './mirrorCalendar';
import {
  fingerprintMirrorBody,
  toGoogleEventBody,
  type MirrorSource,
} from './mirrorMapper';

const GOOGLE_OAUTH_CLIENT_IDS = defineString('GOOGLE_OAUTH_CLIENT_IDS', { default: '' });
const GOOGLE_OAUTH_WEB_CLIENT_ID = defineString('GOOGLE_OAUTH_WEB_CLIENT_ID', { default: '' });
const GOOGLE_OAUTH_WEB_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_WEB_CLIENT_SECRET');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CALENDAR_READ_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const CALENDAR_WRITE_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const scopeSet = (scope: string | undefined): Set<string> =>
  new Set((scope ?? '').split(' ').map((s) => s.trim()).filter(Boolean));
const hasReadScope = (scope: string | undefined): boolean => {
  const scopes = scopeSet(scope);
  return scopes.has(CALENDAR_READ_SCOPE) || scopes.has(CALENDAR_WRITE_SCOPE);
};
const hasWriteScope = (scope: string | undefined): boolean => scopeSet(scope).has(CALENDAR_WRITE_SCOPE);

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

const connectionRef = (uid: string) =>
  firestore.collection('users').doc(uid).collection('connections').doc('google_calendar');

const mirrorRef = (uid: string, suiId: string) =>
  firestore.collection('users').doc(uid).collection('mirror').doc(suiId);

type MirrorDoc = {
  googleCalendarId: string;
  googleEventId: string;
  fingerprint: string;
  suiType: 'goal' | 'habit';
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

const toMirrorSource = (
  suiType: 'goal' | 'habit',
  suiId: string,
  entity: Record<string, unknown>,
): MirrorSource | null => {
  if (typeof entity.title !== 'string') return null;
  if (suiType === 'goal') {
    if (typeof entity.deadline !== 'string') return null;
    return {
      suiType: 'goal',
      suiId,
      title: entity.title,
      deadline: entity.deadline,
      impactDays: Array.isArray(entity.impactDays)
        ? entity.impactDays.filter((d): d is string => typeof d === 'string')
        : undefined,
      completed: entity.completed === true,
      gravity: entity.gravity === 'high' ? 'high' : 'low',
      mirrorToGoogle: typeof entity.mirrorToGoogle === 'boolean' ? entity.mirrorToGoogle : undefined,
    };
  }
  return {
    suiType: 'habit',
    suiId,
    title: entity.title,
    frequency:
      entity.frequency === 'daily' || Array.isArray(entity.frequency)
        ? (entity.frequency as 'daily' | ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[])
        : 'daily',
    plannedTime: typeof entity.plannedTime === 'string' ? entity.plannedTime : undefined,
    completed: entity.completed === true,
    mirrorToGoogle: typeof entity.mirrorToGoogle === 'boolean' ? entity.mirrorToGoogle : undefined,
  };
};

const allowedClientIds = (): Set<string> =>
  new Set(
    GOOGLE_OAUTH_CLIENT_IDS.value()
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const authenticate = async (request: { headers: Record<string, unknown> }) => {
  const authorization =
    typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined;
  return authenticateBearer(authorization);
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
  const authentication = await authenticate(request);
  if (!authentication.ok) {
    response.status(401).json({ error: 'Invalid authentication' });
    return null;
  }
  return authentication.uid;
};

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

const refreshAccessToken = async (document: ConnectionDocument): Promise<ConnectionDocument> => {
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
  return {
    ...document,
    accessToken: token.access_token ?? '',
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    scope: token.scope ?? document.scope,
  };
};

const getActiveConnection = async (uid: string): Promise<ConnectionDocument> => {
  const ref = connectionRef(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error('not_connected');
  let connection = snapshot.data() as ConnectionDocument;
  if (connection.expiresAt <= Date.now() + 60_000) {
    connection = await refreshAccessToken(connection);
    await ref.set({ ...connection, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  return connection;
};

const fetchEvents = (accessToken: string) => fetchCalendarEvents(accessToken);

const functionOptions = {
  secrets: [GOOGLE_OAUTH_WEB_CLIENT_SECRET],
  cors: false,
  timeoutSeconds: 30,
  memory: '256MiB' as const,
};

export const disconnectGoogleCalendarForUser = async (uid: string): Promise<void> => {
  const ref = connectionRef(uid);
  const snapshot = await ref.get();
  const connection = snapshot.data() as ConnectionDocument | undefined;
  if (connection) {
    const token = connection.refreshToken ?? connection.accessToken;
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    }).catch(() => undefined);
  }
  await ref.delete();
};

export const googleCalendarConnect = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, 'POST', 'googleCalendarConnect');
  if (!uid) return;
  const body = parseBody(request.body);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const codeVerifier = typeof body.codeVerifier === 'string' ? body.codeVerifier.trim() : '';
  const redirectUri = typeof body.redirectUri === 'string' ? body.redirectUri.trim() : '';
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
  if (!code || !codeVerifier || !redirectUri) {
    response.status(400).json({ error: 'Invalid OAuth request' });
    return;
  }
  const allowed = allowedClientIds();
  if (!allowed.has(clientId)) {
    // Misconfig típico: GOOGLE_OAUTH_CLIENT_IDS vacío en el .env del proyecto.
    logger.warn('googleCalendarConnect rejected client', {
      operation: 'googleCalendarConnect',
      configuredClients: allowed.size,
    });
    response.status(400).json({ error: 'OAuth client not allowed' });
    return;
  }
  try {
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
    if (!hasReadScope(token.scope)) {
      response.status(403).json({ error: 'Calendar permission missing' });
      return;
    }
    const ref = connectionRef(uid);
    const previous = await ref.get();
    const previousRefreshToken = previous.data()?.refreshToken as string | undefined;
    await ref.set({
      provider: 'google_calendar',
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? previousRefreshToken,
      expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
      clientId,
      scope: token.scope,
      updatedAt: FieldValue.serverTimestamp(),
    });
    response.status(200).json({ connected: true });
  } catch {
    response.status(502).json({ error: 'Google authorization failed' });
  }
});

export const googleCalendarStatus = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, 'GET', 'googleCalendarStatus');
  if (!uid) return;
  response.status(200).json({ connected: (await connectionRef(uid).get()).exists });
});

export const googleCalendarSync = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, 'POST', 'googleCalendarSync');
  if (!uid) return;
  try {
    const connection = await getActiveConnection(uid);
    const events = await fetchEvents(connection.accessToken);
    response.status(200).json({ events, syncedAt: Date.now() });
  } catch (error) {
    const code =
      error instanceof CalendarFetchError
        ? error.code
        : error instanceof Error && error.message === 'reconnect_required'
          ? 'reconnect_required'
          : 'calendar_fetch_failed';
    const status = code === 'reconnect_required' ? 401 : code === 'rate_limited' ? 429 : 502;
    response.status(status).json({
      error:
        code === 'reconnect_required'
          ? 'Reconnect Google Calendar'
          : code === 'rate_limited'
            ? 'Calendar rate limited'
            : 'Calendar sync failed',
    });
  }
});

export const googleCalendarDisconnect = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, 'POST', 'googleCalendarDisconnect');
  if (!uid) return;
  await disconnectGoogleCalendarForUser(uid);
  response.status(200).json({ connected: false });
});

const mirrorErrorStatus = (error: unknown): number => {
  if (error instanceof GoogleApiError) {
    if (error.code === 'reconnect_required') return 401;
    if (error.code === 'rate_limited') return 429;
    if (error.code === 'not_found') return 502;
  }
  const code = error instanceof Error ? error.message : '';
  if (code === 'not_connected' || code === 'reconnect_required' || code === 'write_forbidden') return 401;
  if (code === 'mirror_disabled' || code === 'invalid_mirror_request') return 400;
  return 502;
};

/**
 * Espeja un Goal/Habit Sui en el calendario dedicado "Sui" de Google.
 * Body: { suiId, suiType: goal|habit, startDate?: YYYY-MM-DD, timeZone?: string }.
 * Lee la entidad desde Firestore (fuente de verdad), no confía en payload cliente.
 * Idempotente por fingerprint: si nada cambió, no hace PATCH.
 */
export const googleMirrorUpsert = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, 'POST', 'googleMirrorUpsert');
  if (!uid) return;
  try {
    const body = parseBody(request.body);
    const suiId = typeof body.suiId === 'string' ? body.suiId.trim() : '';
    const suiType = body.suiType === 'goal' || body.suiType === 'habit' ? body.suiType : null;
    const startDate =
      typeof body.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)
        ? body.startDate
        : new Date().toISOString().slice(0, 10);
    const timeZone = typeof body.timeZone === 'string' && body.timeZone.length <= 64 ? body.timeZone : undefined;
    if (!suiId || !suiType) throw new Error('invalid_mirror_request');

    const connection = await getActiveConnection(uid);
    if (!hasWriteScope(connection.scope)) throw new Error('write_forbidden');

    const entity = await readSuiEntity(uid, suiType, suiId);
    const ref = mirrorRef(uid, suiId);
    if (!entity) {
      const existing = (await ref.get()).data() as MirrorDoc | undefined;
      if (existing) {
        await deleteCalendarEvent(connection.accessToken, existing.googleCalendarId, existing.googleEventId).catch(
          () => undefined,
        );
        await ref.delete();
      }
      response.status(200).json({ deleted: true });
      return;
    }

    const source = toMirrorSource(suiType, suiId, entity);
    const eventBody = source ? toGoogleEventBody(source, { startDate, timeZone }) : null;
    if (!eventBody) throw new Error('mirror_disabled');

    // El scope calendar.events no permite listar/crear calendarios: según el
    // scope concedido, el espejo escribe en el primario o en el dedicado "Sui".
    const calendarId = await resolveMirrorCalendarId(
      connection.accessToken,
      connection.scope,
      ensureSuiCalendar,
    );
    const fingerprint = fingerprintMirrorBody(eventBody);
    const previous = (await ref.get()).data() as MirrorDoc | undefined;
    if (previous && previous.fingerprint === fingerprint && previous.googleCalendarId === calendarId) {
      response.status(200).json({
        googleEventId: previous.googleEventId,
        calendarId,
        status: 'mirrored',
        unchanged: true,
      });
      return;
    }

    let googleEventId = previous?.googleEventId;
    if (googleEventId && previous?.googleCalendarId === calendarId) {
      try {
        await patchCalendarEvent(connection.accessToken, calendarId, googleEventId, eventBody);
      } catch (error) {
        if (error instanceof GoogleApiError && error.code === 'not_found') {
          googleEventId = undefined;
        } else {
          throw error;
        }
      }
    }
    if (!googleEventId) {
      googleEventId = (await createCalendarEvent(connection.accessToken, calendarId, eventBody)).id;
    }
    await ref.set(
      {
        googleCalendarId: calendarId,
        googleEventId,
        fingerprint,
        suiType,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    response.status(200).json({ googleEventId, calendarId, status: 'mirrored', unchanged: false });
  } catch (error) {
    response.status(mirrorErrorStatus(error)).json({
      error: error instanceof Error ? error.message : 'mirror_failed',
    });
  }
});

/** Elimina el espejo de un item (borra en Google si existe + borra mapeo). */
export const googleMirrorDelete = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, 'POST', 'googleMirrorDelete');
  if (!uid) return;
  try {
    const body = parseBody(request.body);
    const suiId = typeof body.suiId === 'string' ? body.suiId.trim() : '';
    if (!suiId) throw new Error('invalid_mirror_request');
    const connection = await getActiveConnection(uid);
    if (!hasWriteScope(connection.scope)) throw new Error('write_forbidden');
    const ref = mirrorRef(uid, suiId);
    const existing = (await ref.get()).data() as MirrorDoc | undefined;
    if (existing) {
      await deleteCalendarEvent(connection.accessToken, existing.googleCalendarId, existing.googleEventId).catch(
        () => undefined,
      );
      await ref.delete();
    }
    response.status(200).json({ deleted: true });
  } catch (error) {
    response.status(mirrorErrorStatus(error)).json({
      error: error instanceof Error ? error.message : 'mirror_failed',
    });
  }
});
