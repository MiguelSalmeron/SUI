import { auth, getAppCheckToken } from '@/shared/infrastructure/firebase/firebase';
import { ConnectionApiError } from '@/features/calendar/public';

/**
 * Cliente HTTP de Google Tasks. Replica el patrón de `googleConnectionApi`
 * (App Check + bearer + errores tipados por status) contra los endpoints de
 * Tasks. El refresh token nunca pasa por acá: vive en Firestore, en el backend.
 *
 * Reutiliza `ConnectionApiError` (vía `calendar/public`, que es el único cruce
 * permitido entre features) en vez de declarar otra clase: el traductor de
 * errores ya distingue 401/429 por status, y una clase propia obligaría a
 * duplicar esa lógica.
 */

const API_BASE = process.env.EXPO_PUBLIC_CONNECTIONS_API_URL?.trim().replace(/\/$/, '') ?? '';

export type NormalizedTask = {
  id: string;
  taskListId: string;
  title: string;
  notes?: string;
  /** YYYY-MM-DD, presente sólo si la tarea tiene vencimiento. */
  dueDate?: string;
  completed: boolean;
};

type ConnectionStatusResponse = { connected: boolean };
type TaskListResponse = { tasks: NormalizedTask[]; syncedAt: number };
type MirrorUpsertResponse = {
  googleTaskId: string;
  taskListId: string;
  status: string;
  unchanged?: boolean;
  deleted?: boolean;
};

// Se reexporta la clase de Calendar (y no una propia) porque el traductor de
// errores ya distingue 401/429 por status; una clase distinta obligaría a
// duplicar esa lógica.
export { ConnectionApiError };

export const googleTasksApiConfigured = (): boolean => Boolean(API_BASE);

const request = async <T>(endpoint: string, init: RequestInit = {}): Promise<T> => {
  const user = auth.currentUser;
  if (!user) throw new ConnectionApiError(401, 'Sesión no disponible.');
  if (!API_BASE) throw new ConnectionApiError(503, 'Conexiones no configuradas.');

  const [idToken, appCheckToken] = await Promise.all([user.getIdToken(), getAppCheckToken()]);
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new ConnectionApiError(
      response.status,
      body.error || 'No se pudo completar la conexión.',
    );
  }
  return body;
};

export const getGoogleTasksConnectionStatus = async (): Promise<boolean> =>
  (await request<ConnectionStatusResponse>('googleTasksStatus', { method: 'GET' })).connected;

export const connectGoogleTasks = async (params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
}): Promise<void> => {
  await request('googleTasksConnect', {
    method: 'POST',
    body: JSON.stringify(params),
  });
};

export const syncGoogleTasksConnection = async (): Promise<TaskListResponse> =>
  request<TaskListResponse>('googleTasksSync', {
    method: 'POST',
    body: JSON.stringify({}),
  });

export const disconnectGoogleTasksConnection = async (): Promise<void> => {
  await request('googleTasksDisconnect', {
    method: 'POST',
    body: JSON.stringify({}),
  });
};

export const tasksMirrorUpsert = async (params: {
  suiId: string;
  suiType: 'goal' | 'habit';
  startDate?: string;
}): Promise<MirrorUpsertResponse> =>
  request<MirrorUpsertResponse>('googleTasksMirrorUpsert', {
    method: 'POST',
    body: JSON.stringify(params),
  });

export const tasksMirrorDelete = async (suiId: string): Promise<void> => {
  await request('googleTasksMirrorDelete', {
    method: 'POST',
    body: JSON.stringify({ suiId }),
  });
};
