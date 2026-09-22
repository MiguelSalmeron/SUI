/**
 * Cliente de lectura de Google Calendar (Fase 2: sync de lectura confiable).
 * Aislado de Firebase para poder testearlo con fetch y reloj inyectados.
 */

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/** Eventos multi-día empezados hasta 45 días atrás siguen vigentes "hoy". */
export const SYNC_WINDOW_DAYS_PAST = 45;
export const SYNC_WINDOW_DAYS_FUTURE = 31;

export type GoogleApiEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
};

export type NormalizedEvent = {
  id: string;
  calendarId: 'primary';
  title: string;
  date: string;
  time?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  timeZone?: string;
  location?: string;
  type: 'event';
  source: 'google';
};

export class CalendarFetchError extends Error {
  constructor(readonly code: 'reconnect_required' | 'rate_limited' | 'calendar_fetch_failed') {
    super(code);
    this.name = 'CalendarFetchError';
  }
}

export const normalizeEvent = (event: GoogleApiEvent): NormalizedEvent | null => {
  if (!event.id || event.status === 'cancelled' || !event.start) return null;
  const allDay = Boolean(event.start.date && !event.start.dateTime);
  // Google devuelve `end.date` exclusivo en eventos all-day; el cliente Sui
  // compara `date === dateKey`, así que el último día cuenta restando uno.
  const endRef = allDay && event.end?.date ? decrementDate(event.end.date) : event.end?.dateTime ?? event.end?.date;
  const startAt = event.start.dateTime ?? `${event.start.date}T00:00:00`;
  const endAt = endRef
    ? allDay && event.end?.date
      ? `${endRef}T00:00:00`
      : endRef
    : startAt;
  const date = event.start.date ?? startAt.slice(0, 10);
  const time = allDay ? undefined : startAt.slice(11, 16);
  return {
    id: event.id,
    calendarId: 'primary',
    title: event.summary?.trim() || '',
    date,
    time,
    startAt,
    endAt,
    allDay,
    timeZone: event.start.timeZone,
    location: event.location?.trim() || undefined,
    type: 'event',
    source: 'google',
  };
};

/** YYYY-MM-DD → día anterior (maneja cambio de mes/año vía Date UTC). */
const decrementDate = (dateKey: string): string => {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

/**
 * Descarga eventos de `primary` con paginación (hasta 10 páginas).
 * Ventana: [now - 45d, now + 31d) para que los eventos multi-día en curso
 * sigan apareciendo en la agenda de hoy.
 */
export const fetchCalendarEvents = async (
  accessToken: string,
  options: { now?: Date; fetchImpl?: typeof fetch } = {},
): Promise<NormalizedEvent[]> => {
  const doFetch = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - SYNC_WINDOW_DAYS_PAST);
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + SYNC_WINDOW_DAYS_FUTURE);

  const events: NormalizedEvent[] = [];
  let pageToken = '';
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      showDeleted: 'false',
      maxResults: '250',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await doFetch(`${CALENDAR_API}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new CalendarFetchError(
        response.status === 401
          ? 'reconnect_required'
          : response.status === 429
            ? 'rate_limited'
            : 'calendar_fetch_failed',
      );
    }
    const body = (await response.json()) as { items?: GoogleApiEvent[]; nextPageToken?: string };
    for (const item of body.items ?? []) {
      const normalized = normalizeEvent(item);
      if (normalized) events.push(normalized);
    }
    pageToken = body.nextPageToken ?? '';
    if (!pageToken) break;
  }
  return events.sort((a, b) => a.startAt.localeCompare(b.startAt));
};
