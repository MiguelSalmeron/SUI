import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GoogleEvent, TimelineItem, Goal, Habit } from '@/shared/types/models';
import { isHabitDueToday } from '@/shared/domain/productivity/homeStorage';

export const GOOGLE_CALENDAR_READONLY_SCOPE =
  'https://www.googleapis.com/auth/calendar.readonly';

const GOOGLE_EVENTS_CACHE_KEY = '@sui/google-events-v2';
const LEGACY_GOOGLE_EVENTS_CACHE_KEY = '@sui/google-events-v1';

export type CalendarSyncStatus = 'idle' | 'loading-cache' | 'syncing' | 'synced' | 'offline' | 'error';

export interface GoogleCalendarCache {
  events: GoogleEvent[];
  lastSyncedAt: number | null;
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
        title: [event.title, event.location].filter(Boolean).join(' · '),
        date: event.date,
        time: event.allDay ? undefined : event.time,
        completed: true,
        origin: 'google_calendar',
        originalId: event.id,
        startAt: event.startAt,
      });
    });

  const defaultHabitTimes = [
    { label: '07:30', hour: 7, minute: 30 },
    { label: '10:00', hour: 10, minute: 0 },
    { label: '13:00', hour: 13, minute: 0 },
    { label: '16:00', hour: 16, minute: 0 },
    { label: '19:00', hour: 19, minute: 0 },
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
        title: goal.title,
        date: dateKey,
        time: '23:59',
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
