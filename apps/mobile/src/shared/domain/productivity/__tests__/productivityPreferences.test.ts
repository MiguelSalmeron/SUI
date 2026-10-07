jest.mock('@/shared/observability/telemetry', () => ({ recordTelemetry: jest.fn() }));

jest.mock('@/shared/infrastructure/firebase/firebase', () => ({
  auth: {
    currentUser: null,
    authStateReady: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/shared/account/useIntroStore', () => ({
  useIntroStore: {
    getState: () => ({
      syncEnabled: true,
      previousAnonymousUid: null,
      registerAccount: jest.fn(),
      setPreviousAnonymousUid: jest.fn(),
    }),
  },
}));

jest.mock('../sync/syncCoordinator', () => ({
  synchronizeProductivity: jest.fn(),
  pullCloudProductivity: jest.fn(),
}));

import type { User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import { useSettingsStore } from '@/shared/preferences/useSettingsStore';
import { PRODUCTIVITY_STORAGE_KEY } from '../persistence/storageKeys';
import { synchronizeProductivity } from '../sync/syncCoordinator';
import { useProductivityStore } from '../store/useProductivityStore';
import { productivityRuntime } from '../store/productivityRuntime';

const authMock = auth as unknown as {
  currentUser: unknown;
  authStateReady: jest.Mock;
};
const syncMock = synchronizeProductivity as jest.Mock;

const makeUser = (uid: string) =>
  ({
    uid,
    isAnonymous: false,
    providerData: [{ providerId: 'google.com' }],
  }) as unknown as User;

// Sobre mínimo válido: la copia de preferencias es stale a propósito (dark/en)
// mientras el dispositivo ya eligió claro/español en Ajustes.
const staleEnvelope = (preferences: Record<string, unknown>) =>
  JSON.stringify({
    schemaVersion: 9,
    data: {
      goals: [],
      habits: [],
      weeklyHistory: [],
      streakCount: 0,
      totalXp: 0,
      preferences: { schemaVersion: 1, ...preferences },
    },
    metadata: {},
    summaryMeta: null,
    outbox: [],
    pullState: {
      syncEpoch: 1,
      cursors: { goals: null, habits: null, snapshots: null },
      needsBootstrap: false,
      needsRebase: false,
    },
    lastSyncedAt: null,
  });

const syncResultWith = (preferences: Record<string, unknown>) => ({
  data: {
    goals: [],
    habits: [],
    weeklyHistory: [],
    streakCount: 0,
    totalXp: 0,
    preferences: { schemaVersion: 1, ...preferences },
  },
  metadata: {},
  summaryMeta: null,
  pullState: {
    syncEpoch: 1,
    cursors: { goals: null, habits: null, snapshots: null },
    needsBootstrap: false,
    needsRebase: false,
  },
  lastSyncedAt: '2026-10-01T00:00:00.000Z',
  pending: 0,
  accepted: 0,
  replayed: 0,
  rejected: 0,
  collisions: 0,
  migratedLegacy: false,
  pages: 1,
  compacted: 0,
  epochResets: 0,
});

beforeEach(async () => {
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
  authMock.currentUser = null;
  authMock.authStateReady.mockImplementation(() => Promise.resolve());
  productivityRuntime.loadedForUid = null;
  productivityRuntime.saveInFlight = false;
  productivityRuntime.saveQueued = false;
  productivityRuntime.syncInFlight = false;
  productivityRuntime.syncQueued = false;
  await useProductivityStore.getState().clearState({ preserveStorage: true });
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
  useSettingsStore.setState({
    theme: 'light',
    language: 'es',
    fontSize: 'medium',
    notificationsEnabled: false,
  });
  jest.clearAllMocks();
  authMock.authStateReady.mockImplementation(() => Promise.resolve());
});

describe('apariencia local como autoridad frente al sobre', () => {
  it('loadState conserva el tema claro aunque el sobre traiga dark', async () => {
    // Fijate que el sobre además trae idioma y resto stale: solo la apariencia
    // debe sobrevivir, el resto sí se aplica.
    await AsyncStorage.setItem(
      PRODUCTIVITY_STORAGE_KEY,
      staleEnvelope({
        theme: 'dark',
        language: 'en',
        fontSize: 'large',
        notificationsEnabled: true,
        updatedAt: '2026-10-01T00:00:00.000Z',
      }),
    );

    await useProductivityStore.getState().loadState();

    const settings = useSettingsStore.getState();
    expect(settings.theme).toBe('light');
    expect(settings.language).toBe('es');
    expect(settings.fontSize).toBe('large');
    expect(settings.notificationsEnabled).toBe(true);
  });

  it('post-sync con preferencias remotas distintas no pisa el tema local', async () => {
    authMock.currentUser = makeUser('user-1');
    useSettingsStore.setState({ theme: 'light', language: 'es', fontSize: 'medium' });
    syncMock.mockResolvedValue(
      syncResultWith({
        theme: 'dark',
        language: 'en',
        fontSize: 'small',
        notificationsEnabled: true,
        updatedAt: '2026-10-01T00:00:00.000Z',
      }),
    );

    await useProductivityStore.getState().syncNow();

    const settings = useSettingsStore.getState();
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(settings.theme).toBe('light');
    expect(settings.language).toBe('es');
    // El resto del sobre sí fluye: esto prueba que el fix no muteó todo.
    expect(settings.fontSize).toBe('small');
    expect(settings.notificationsEnabled).toBe(true);
  });
});
