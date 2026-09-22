/**
 * Cliente mínimo Google Calendar REST (Fase 2, escritura + lectura).
 * Centraliza errores tipados para que los handlers respondan 401/429/502.
 */

const GOOGLE_BASE = 'https://www.googleapis.com/calendar/v3';

export class GoogleApiError extends Error {
  constructor(
    readonly code: 'reconnect_required' | 'rate_limited' | 'not_found' | 'calendar_error',
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

const apiFetch = async (
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> => {
  const response = await fetch(`${GOOGLE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (response.status === 401) throw new GoogleApiError('reconnect_required', 401, 'reconnect_required');
  if (response.status === 404) throw new GoogleApiError('not_found', 404, 'not_found');
  if (response.status === 429) throw new GoogleApiError('rate_limited', 429, 'rate_limited');
  if (response.status === 403) {
    const body = (await response.json().catch(() => ({}))) as { error?: { reason?: string } };
    const reason = body.error?.reason ?? '';
    if (reason.includes('rateLimit') || reason.includes('quota') || reason.includes('userRateLimit')) {
      throw new GoogleApiError('rate_limited', 403, 'rate_limited');
    }
    throw new GoogleApiError('calendar_error', 403, 'calendar_error');
  }
  if (!response.ok) throw new GoogleApiError('calendar_error', response.status, 'calendar_error');
  return response.json().catch(() => ({}));
};

export const SUI_CALENDAR_SUMMARY = 'Sui';

export const ensureSuiCalendar = async (accessToken: string): Promise<string> => {
  const list = (await apiFetch(accessToken, '/users/me/calendarList?maxResults=50&showHidden=true')) as {
    items?: { id?: string; summary?: string; deleted?: boolean }[];
  };
  const existing = (list.items ?? []).find(
    (item) => item.summary === SUI_CALENDAR_SUMMARY && !item.deleted && item.id,
  );
  if (existing?.id) return existing.id;
  const created = (await apiFetch(accessToken, '/calendars', {
    method: 'POST',
    body: JSON.stringify({
      summary: SUI_CALENDAR_SUMMARY,
      description: 'Espejo de Sui · tus metas y hábitos con horario',
    }),
  })) as { id?: string };
  if (!created.id) throw new GoogleApiError('calendar_error', 502, 'calendar_create_failed');
  return created.id;
};

export const createCalendarEvent = async (
  accessToken: string,
  calendarId: string,
  body: unknown,
): Promise<{ id: string }> => {
  const created = (await apiFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', body: JSON.stringify(body) },
  )) as { id?: string };
  if (!created.id) throw new GoogleApiError('calendar_error', 502, 'event_create_failed');
  return { id: created.id };
};

export const patchCalendarEvent = async (
  accessToken: string,
  calendarId: string,
  eventId: string,
  body: unknown,
): Promise<void> => {
  await apiFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
};

export const deleteCalendarEvent = async (
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> => {
  try {
    await apiFetch(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' },
    );
  } catch (error) {
    if (error instanceof GoogleApiError && error.code === 'not_found') return;
    throw error;
  }
};
