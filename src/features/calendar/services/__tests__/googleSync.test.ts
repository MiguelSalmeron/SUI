jest.mock('@/shared/domain/productivity/public', () => ({
  localDateKey: (value = new Date()) => value.toISOString().slice(0, 10),
  isHabitDueToday: () => true,
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildUnifiedTimeline,
  loadGoogleCalendarCache,
  saveGoogleEventsCache,
} from '../googleSync';
import type { GoogleEvent, Goal, Habit } from '@/shared/types/models';

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const goal: Goal = {
  id: 'goal-1',
  title: 'Entrega final',
  deadline: '2026-08-11',
  progress: 0,
  milestones: [],
  impactDays: ['2026-08-11'],
  completed: false,
  gravity: 'high',
  createdAt: '2026-08-01',
};

const habit: Habit = {
  id: 'habit-1',
  title: 'Revisar apuntes',
  completed: false,
  frequency: 'daily',
  streak: 2,
  createdAt: '2026-08-01',
};

const googleEvent: GoogleEvent = {
  id: 'event-1',
  calendarId: 'primary',
  title: 'Clase de Física',
  date: '2026-08-11',
  time: '08:00',
  startAt: '2026-08-11T08:00:00.000Z',
  endAt: '2026-08-11T09:00:00.000Z',
  allDay: false,
  type: 'event',
  source: 'google',
};

describe('googleSync', () => {
  beforeEach(() => {
    mockedStorage.getItem.mockResolvedValue(null);
    mockedStorage.setItem.mockResolvedValue(undefined);
    mockedStorage.removeItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('no crea eventos demo cuando no existe caché', async () => {
    await expect(loadGoogleCalendarCache()).resolves.toEqual({
      events: [],
      lastSyncedAt: null,
    });
  });

  it('persiste sólo eventos normalizados entregados por backend', async () => {
    await saveGoogleEventsCache([googleEvent], 123);
    expect(mockedStorage.setItem).toHaveBeenCalledWith(
      '@sui/google-events-v2',
      JSON.stringify({ events: [googleEvent], lastSyncedAt: 123 }),
    );
  });

  it('mezcla y ordena por timestamp, no por texto AM/PM', () => {
    const timeline = buildUnifiedTimeline('2026-08-11', [googleEvent], [goal], [habit]);

    expect(timeline.map((item) => item.origin)).toEqual(['habit', 'google_calendar', 'goal']);
  });
});
