import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GoogleEvent, TimelineItem, Goal, Habit } from '../types/models';
import { localDateKey, isHabitDueToday } from './homeStorage';

export const GOOGLE_CALENDAR_READONLY_SCOPE =
  'https://www.googleapis.com/auth/calendar.readonly';

const GOOGLE_EVENTS_CACHE_KEY = '@sui/google-events-v2';
const LEGACY_GOOGLE_EVENTS_CACHE_KEY = '@sui/google-events-v1';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars';
const MAX_PAGES = 10;
const PAGE_SIZE = 250;

export type CalendarSyncStatus = 'idle' | 'loading-cache' | 'syncing' | 'synced' | 'offline' | 'error';

export interface GoogleCalendarCache {
  events: GoogleEvent[];
  lastSyncedAt: number | null;
}

export interface CalendarRange {
  timeMin: Date;
  timeMax: Date;
}

interface GoogleApiEvent {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
}

interface GoogleApiResponse {
  items?: GoogleApiEvent[];
  nextPageToken?: string;
}

export class GoogleCalendarError extends Error {
  readonly code: 'missing-token' | 'unauthorized' | 'rate-limited' | 'request-failed' | 'invalid-response';

  constructor(
    code: GoogleCalendarError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'GoogleCalendarError';
    this.code = code;
  }
}

const EMPTY_CACHE: GoogleCalendarCache = {
  events: [],
  lastSyncedAt: null,
};

const isGoogleEvent = (value: unknown): value is GoogleEvent => {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<GoogleEvent>;
  return (
    typeof event.id === 'string' &&
    typeof event.calendarId === 'string' &&
    typeof event.title === 'string' &&
    typeof event.date === 'string' &&
    typeof event.startAt === 'string' &&
    typeof event.endAt === 'string' &&
    typeof event.allDay === 'boolean' &&
    event.source === 'google'
  );
};

const parseCache = (raw: string | null): GoogleCalendarCache => {
  if (!raw) return EMPTY_CACHE;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY_CACHE;

    const value = parsed as { events?: unknown; lastSyncedAt?: unknown };
    const events = Array.isArray(value.events)
      ? value.events.filter(isGoogleEvent)
      : [];
    const lastSyncedAt =
      typeof value.lastSyncedAt === 'number' && Number.isFinite(value.lastSyncedAt)
        ? value.lastSyncedAt
        : null;

    return { events, lastSyncedAt };
  } catch {
    return EMPTY_CACHE;
  }
};

/** Carga solo la última caché real; nunca crea eventos falsos. */
export const loadGoogleCalendarCache = async (): Promise<GoogleCalendarCache> => {
  try {
    return parseCache(await AsyncStorage.getItem(GOOGLE_EVENTS_CACHE_KEY));
  } catch {
    return EMPTY_CACHE;
  }
};

/** Compatibilidad para consumidores que solo necesitan los eventos. */
export const loadCachedGoogleEvents = async (): Promise<GoogleEvent[]> =>
  (await loadGoogleCalendarCache()).events;

export const saveGoogleEventsCache = async (
  events: GoogleEvent[],
  lastSyncedAt: number = Date.now(),
): Promise<void> => {
  const cache: GoogleCalendarCache = { events, lastSyncedAt };
  await AsyncStorage.setItem(GOOGLE_EVENTS_CACHE_KEY, JSON.stringify(cache));
};

export const clearGoogleEventsCache = async (): Promise<void> => {
  await Promise.all([
    AsyncStorage.removeItem(GOOGLE_EVENTS_CACHE_KEY),
    AsyncStorage.removeItem(LEGACY_GOOGLE_EVENTS_CACHE_KEY),
  ]);
};

export const defaultCalendarRange = (): CalendarRange => {
  const now = new Date();
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + 31);
  return { timeMin: now, timeMax };
};

const formatTime = (dateTime: string): string =>
  new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateTime));

const normalizeEvent = (
  event: GoogleApiEvent,
  calendarId: string,
): GoogleEvent | null => {
  if (!event.id || event.status === 'cancelled' || !event.start) return null;

  const allDay = Boolean(event.start.date && !event.start.dateTime);
  const startAt = event.start.dateTime ?? `${event.start.date}T00:00:00`;
  const endAt = event.end?.dateTime ?? `${event.end?.date ?? event.start.date}T00:00:00`;
  const date = event.start.date ?? localDateKey(new Date(startAt));

  return {
    id: event.id,
    calendarId,
    title: event.summary?.trim() || 'Evento sin título',
    date,
    time: allDay ? undefined : formatTime(startAt),
    startAt,
    endAt,
    allDay,
    timeZone: event.start.timeZone,
    location: event.location?.trim() || undefined,
    type: 'event',
    source: 'google',
  };
};

const buildEventsUrl = (
  calendarId: string,
  range: CalendarRange,
  pageToken?: string,
): string => {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    showDeleted: 'false',
    maxResults: String(PAGE_SIZE),
    timeMin: range.timeMin.toISOString(),
    timeMax: range.timeMax.toISOString(),
  });
  if (pageToken) params.set('pageToken', pageToken);
  return `${GOOGLE_CALENDAR_API}/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
};

/** Descarga eventos de solo lectura desde la API oficial de Google Calendar. */
export const fetchGoogleCalendarEvents = async (
  accessToken: string,
  range: CalendarRange = defaultCalendarRange(),
  calendarId = 'primary',
): Promise<GoogleEvent[]> => {
  const token = accessToken.trim();
  if (!token) {
    throw new GoogleCalendarError('missing-token', 'Falta el token de Google Calendar.');
  }

  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetch(buildEventsUrl(calendarId, range, pageToken), {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new GoogleCalendarError(
        'unauthorized',
        'El permiso de Google Calendar expiró o fue denegado.',
      );
    }
    if (response.status === 429) {
      throw new GoogleCalendarError(
        'rate-limited',
        'Google Calendar limitó temporalmente la sincronización.',
      );
    }
    if (!response.ok) {
      throw new GoogleCalendarError(
        'request-failed',
        `Google Calendar respondió con ${response.status}.`,
      );
    }

    let data: GoogleApiResponse;
    try {
      data = (await response.json()) as GoogleApiResponse;
    } catch {
      throw new GoogleCalendarError(
        'invalid-response',
        'La respuesta de Google Calendar no es válida.',
      );
    }

    for (const item of data.items ?? []) {
      const normalized = normalizeEvent(item, calendarId);
      if (normalized) events.push(normalized);
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return events.sort((a, b) => a.startAt.localeCompare(b.startAt));
};

export const syncGoogleCalendar = async (
  accessToken: string,
  range: CalendarRange = defaultCalendarRange(),
): Promise<GoogleCalendarCache> => {
  const events = await fetchGoogleCalendarEvents(accessToken, range);
  const lastSyncedAt = Date.now();
  await saveGoogleEventsCache(events, lastSyncedAt);
  return { events, lastSyncedAt };
};

/**
 * Fusiona Google Calendar, hábitos y metas en la agenda de SUI.
 * Los eventos de Google son informativos y no se pueden marcar como hechos.
 */
export const buildUnifiedTimeline = (
  dateKey: string,
  googleEvents: GoogleEvent[],
  goals: Goal[],
  habits: Habit[],
): TimelineItem[] => {
  const items: TimelineItem[] = [];
  const dateObj = new Date(`${dateKey}T00:00:00`);

  googleEvents
    .filter((event) => event.date === dateKey)
    .forEach((event) => {
      items.push({
        id: `timeline-google-${event.calendarId}-${event.id}`,
        title: `${event.title}${event.location ? ` · ${event.location}` : ''}`,
        date: event.date,
        time: event.allDay ? 'Todo el día' : event.time,
        completed: true,
        origin: 'google_calendar',
        originalId: event.id,
        startAt: event.startAt,
      });
    });

  const defaultHabitTimes = [
    { label: '07:30 AM', hour: 7, minute: 30 },
    { label: '10:00 AM', hour: 10, minute: 0 },
    { label: '01:00 PM', hour: 13, minute: 0 },
    { label: '04:00 PM', hour: 16, minute: 0 },
    { label: '07:00 PM', hour: 19, minute: 0 },
  ];

  habits
    .filter((habit) => isHabitDueToday(habit, dateObj))
    .forEach((habit, index) => {
      const linkedGoal = goals.find((goal) => goal.id === habit.linkedGoalId);
      const assigned = defaultHabitTimes[index % defaultHabitTimes.length];
      const startAt = `${dateKey}T${String(assigned.hour).padStart(2, '0')}:${String(assigned.minute).padStart(2, '0')}:00`;

      items.push({
        id: `timeline-habit-${habit.id}`,
        title: habit.title,
        date: dateKey,
        time: assigned.label,
        completed: habit.completed,
        origin: 'habit',
        streak: habit.streak,
        linkedGoalTitle: linkedGoal?.title,
        originalId: habit.id,
        startAt,
      });
    });

  goals
    .filter((goal) => goal.deadline === dateKey || goal.impactDays?.includes(dateKey))
    .forEach((goal) => {
      items.push({
        id: `timeline-goal-${goal.id}`,
        title: `ENTREGA: ${goal.title}`,
        date: dateKey,
        time: '11:59 PM',
        completed: goal.completed,
        origin: 'goal',
        gravity: goal.gravity,
        originalId: goal.id,
        startAt: `${dateKey}T23:59:59`,
      });
    });

  return items.sort((a, b) =>
    (a.startAt ?? `${a.date}T23:59:59`).localeCompare(
      b.startAt ?? `${b.date}T23:59:59`,
    ),
  );
};
