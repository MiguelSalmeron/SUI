import { auth, getAppCheckToken } from '@/shared/infrastructure/firebase/firebase';
import type { GoogleEvent } from '@/shared/types/models';

const API_BASE = process.env.EXPO_PUBLIC_CONNECTIONS_API_URL?.trim().replace(/\/$/, '') ?? '';

type ConnectionStatusResponse = { connected: boolean };
type CalendarEventsResponse = { events: GoogleEvent[]; syncedAt: number };

export class ConnectionApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ConnectionApiError';
  }
}

export const googleCalendarApiConfigured = (): boolean => Boolean(API_BASE);

const request = async <T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<T> => {
  const user = auth.currentUser;
  if (!user) throw new ConnectionApiError(401, 'Sesión no disponible.');
  if (!API_BASE) throw new ConnectionApiError(503, 'Conexiones no configuradas.');

  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getAppCheckToken(),
  ]);
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
  const body = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) {
    throw new ConnectionApiError(response.status, body.error || 'No se pudo completar la conexión.');
  }
  return body;
};

export const getGoogleCalendarConnectionStatus = async (): Promise<boolean> =>
  (await request<ConnectionStatusResponse>('googleCalendarStatus', { method: 'GET' })).connected;

export const connectGoogleCalendar = async (params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
}): Promise<void> => {
  await request('googleCalendarConnect', {
    method: 'POST',
    body: JSON.stringify(params),
  });
};

export const syncGoogleCalendarConnection = async (): Promise<CalendarEventsResponse> =>
  request<CalendarEventsResponse>('googleCalendarSync', {
    method: 'POST',
    body: JSON.stringify({}),
  });

export const disconnectGoogleCalendarConnection = async (): Promise<void> => {
  await request('googleCalendarDisconnect', {
    method: 'POST',
    body: JSON.stringify({}),
  });
};
