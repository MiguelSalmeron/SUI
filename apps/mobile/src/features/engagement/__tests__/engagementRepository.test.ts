import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_ENGAGEMENT_ENVELOPE, ENGAGEMENT_STORAGE_KEY } from '../model/engagementTypes';
import {
  migrateEngagementGuestToUser,
  writeEngagement,
  loadEngagement,
} from '../services/engagementRepository';

describe('migración de Engagement', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
  });
  afterEach(() => jest.restoreAllMocks());

  it('copia invitado válido, verifica y limpia únicamente su namespace', async () => {
    const guest = EMPTY_ENGAGEMENT_ENVELOPE('2026-10-01T12:00:00.000Z');
    guest.profile.cadence = 'present';
    await writeEngagement(guest, 'anon');
    await writeEngagement(EMPTY_ENGAGEMENT_ENVELOPE('2026-10-01T12:00:00.000Z'));
    await migrateEngagementGuestToUser('user', 'anon');
    expect((await loadEngagement('user')).profile.cadence).toBe('present');
    expect(await AsyncStorage.getItem(`${ENGAGEMENT_STORAGE_KEY}:anon`)).toBeNull();
    expect(await AsyncStorage.getItem(ENGAGEMENT_STORAGE_KEY)).not.toBeNull();
  });

  it('reintento tras fallo de limpieza complementa por ID y conserva perfil de cuenta', async () => {
    const guest = EMPTY_ENGAGEMENT_ENVELOPE('2026-10-01T12:00:00.000Z');
    guest.slots = [
      { id: '2026-10-01:600', dayKey: '2026-10-01', startMinute: 600, status: 'planned' },
    ];
    const user = EMPTY_ENGAGEMENT_ENVELOPE('2026-10-01T12:00:00.000Z');
    user.profile.cadence = 'steady';
    await writeEngagement(guest);
    await writeEngagement(user, 'user');
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('Limpieza fallida'));
    await expect(migrateEngagementGuestToUser('user')).rejects.toThrow('Limpieza fallida');
    await migrateEngagementGuestToUser('user');
    const merged = await loadEngagement('user');
    expect(merged.slots).toHaveLength(1);
    expect(merged.profile.cadence).toBe('steady');
  });
});
