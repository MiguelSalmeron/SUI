import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildUnifiedTimeline,
  fetchGoogleCalendarEvents,
  loadGoogleCalendarCache,
} from '../googleSync';
import type { GoogleEvent, Goal, Habit } from '../../types/models';

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
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockedStorage.getItem.mockResolvedValue(null);
    mockedStorage.setItem.mockResolvedValue(undefined);
    mockedStorage.removeItem.mockResolvedValue(undefined);
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('no crea eventos demo cuando no existe caché', async () => {
    await expect(loadGoogleCalendarCache()).resolves.toEqual({
      events: [],
      lastSyncedAt: null,
    });
  });

  it('normaliza eventos reales de Google y omite cancelados', async () => {
    const response = {
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 'timed-1',
            summary: 'Clase',
            start: { dateTime: '2026-08-11T08:00:00-06:00', timeZone: 'America/Managua' },
            end: { dateTime: '2026-08-11T09:00:00-06:00', timeZone: 'America/Managua' },
          },
          {
            id: 'cancelled-1',
            status: 'cancelled',
            summary: 'Cancelado',
            start: { date: '2026-08-11' },
            end: { date: '2026-08-12' },
          },
        ],
      }),
    };
    (global.fetch as jest.Mock).mockResolvedValue(response);

    const events = await fetchGoogleCalendarEvents('access-token', {
      timeMin: new Date('2026-08-11T00:00:00.000Z'),
      timeMax: new Date('2026-08-12T00:00:00.000Z'),
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'timed-1',
      calendarId: 'primary',
      title: 'Clase',
      allDay: false,
      source: 'google',
      timeZone: 'America/Managua',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('mezcla y ordena por timestamp, no por texto AM/PM', () => {
    const timeline = buildUnifiedTimeline('2026-08-11', [googleEvent], [goal], [habit]);

    expect(timeline.map((item) => item.origin)).toEqual(['habit', 'google_calendar', 'goal']);
  });
});
