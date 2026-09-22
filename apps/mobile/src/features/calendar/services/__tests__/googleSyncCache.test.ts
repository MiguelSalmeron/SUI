import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadGoogleCalendarCache,
  resolveLoadedCache,
  saveGoogleEventsCache,
  type GoogleCalendarCache,
} from '../googleSync';
import type { GoogleEvent } from '@/shared/types/models';

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const event = (id: string): GoogleEvent => ({
  id,
  calendarId: 'primary',
  title: `Evento ${id}`,
  date: '2026-09-10',
  time: '08:00',
  startAt: '2026-09-10T08:00:00.000Z',
  endAt: '2026-09-10T09:00:00.000Z',
  allDay: false,
  type: 'event',
  source: 'google',
});

const legacyCache = {
  events: [event('legacy')],
  lastSyncedAt: 42,
};

const owned = (uid: string): GoogleCalendarCache => ({
  events: [event(uid)],
  lastSyncedAt: 42,
  ownerUid: uid,
});

describe('caché de eventos por cuenta', () => {
  beforeEach(() => {
    mockedStorage.getItem.mockResolvedValue(null);
    mockedStorage.setItem.mockResolvedValue(undefined);
  });

  it('guarda ownerUid junto a los eventos', async () => {
    await saveGoogleEventsCache([event('a')], 123, 'uid-A');
    expect(mockedStorage.setItem).toHaveBeenCalledWith(
      '@sui/google-events-v2',
      JSON.stringify({ events: [event('a')], lastSyncedAt: 123, ownerUid: 'uid-A' }),
    );
  });

  it('descarta caché de otra cuenta', () => {
    expect(resolveLoadedCache(owned('uid-A'), 'uid-B')).toEqual({
      events: [],
      lastSyncedAt: null,
    });
  });

  it('conserva caché del mismo dueño', () => {
    expect(resolveLoadedCache(owned('uid-A'), 'uid-A')).toEqual(owned('uid-A'));
  });

  it('descarta caché legada sin ownerUid', () => {
    expect(resolveLoadedCache(legacyCache, 'uid-A')).toEqual({
      events: [],
      lastSyncedAt: null,
    });
  });

  it('sin sesión resuelta no descarta todavía', () => {
    expect(resolveLoadedCache(owned('uid-A'), '')).toEqual(owned('uid-A'));
  });

  it('loadGoogleCalendarCache parsea y valida ownerUid', async () => {
    mockedStorage.getItem.mockResolvedValue(
      JSON.stringify({ events: [event('ok')], lastSyncedAt: 7, ownerUid: 'uid-A' }),
    );
    await expect(loadGoogleCalendarCache()).resolves.toEqual({
      events: [event('ok')],
      lastSyncedAt: 7,
      ownerUid: 'uid-A',
    });

    mockedStorage.getItem.mockResolvedValue(JSON.stringify(legacyCache));
    await expect(loadGoogleCalendarCache()).resolves.toEqual({
      events: [],
      lastSyncedAt: null,
    });
  });
});
