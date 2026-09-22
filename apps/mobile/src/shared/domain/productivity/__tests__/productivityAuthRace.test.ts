jest.mock('@/shared/observability/telemetry', () => ({ recordTelemetry: jest.fn() }));

import type { User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_RESULT = {
  data: { goals: [], habits: [], weeklyHistory: [], streakCount: 0, totalXp: 0 },
  metadata: {},
  summaryMeta: null,
  pullState: {
    syncEpoch: 1,
    cursors: { goals: null, habits: null, snapshots: null },
    needsBootstrap: false,
    needsRebase: false,
  },
  lastSyncedAt: '2026-09-08T12:00:00.000Z',
  pending: 0,
  accepted: 0,
  replayed: 0,
  rejected: 0,
  collisions: 0,
  migratedLegacy: false,
  pages: 1,
  compacted: 0,
  epochResets: 0,
};

jest.mock('@/shared/infrastructure/firebase/firebase', () => ({
  auth: {
    currentUser: null,
    authStateReady: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/shared/account/useIntroStore', () => ({
  useIntroStore: {
    getState: () => ({
      syncEnabled: false,
      previousAnonymousUid: null,
      registerAccount: jest.fn(),
      setPreviousAnonymousUid: jest.fn(),
    }),
  },
}));

jest.mock('../sync/syncCoordinator', () => ({
  synchronizeProductivity: jest.fn(() => Promise.resolve(SYNC_RESULT)),
  pullCloudProductivity: jest.fn(() => Promise.resolve(SYNC_RESULT)),
}));

import { auth } from '@/shared/infrastructure/firebase/firebase';
import { useProductivityStore } from '../store/useProductivityStore';

const authMock = auth as unknown as {
  currentUser: unknown;
  authStateReady: jest.Mock;
};

const makeUser = (uid: string) =>
  ({
    uid,
    isAnonymous: false,
    providerData: [{ providerId: 'google.com' }],
  }) as unknown as User;

const flush = async () => {
  for (let i = 0; i < 30; i += 1) {
    await Promise.resolve();
  }
};

const USER_KEY = 'sui-productivity-v9';
const keyFor = (uid: string) => `${USER_KEY}:${uid}`;

beforeEach(async () => {
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
  authMock.authStateReady.mockImplementation(() => Promise.resolve());
  authMock.currentUser = null;
  await useProductivityStore.getState().clearState({ preserveStorage: true });
  jest.clearAllMocks();
  authMock.authStateReady.mockImplementation(() => Promise.resolve());
});

describe('carrera entre restauración de sesión y loadState', () => {
  it('loadState espera authStateReady y usa el uid restaurado, no la clave base', async () => {
    let resolveReady: (() => void) | undefined;
    authMock.authStateReady.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveReady = resolve;
        }),
    );
    authMock.currentUser = null;

    const loadPromise = useProductivityStore.getState().loadState();
    await flush();

    // Mientras la sesión no se ha restaurado, no debe haber leído ni escrito nada.
    expect(useProductivityStore.getState().stateLoaded).toBe(false);
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();

    // La sesión aparece (restauración asíncrona de Firebase Auth).
    authMock.currentUser = makeUser('uid-restored');
    resolveReady?.();
    await loadPromise;

    expect(useProductivityStore.getState().stateLoaded).toBe(true);
    // La primera lectura debe apuntar a la clave del uid restaurado.
    expect(AsyncStorage.getItem).toHaveBeenNthCalledWith(1, keyFor('uid-restored'));
    const keys = await AsyncStorage.getAllKeys();
    expect(keys).toContain(keyFor('uid-restored'));
    expect(keys).not.toContain(USER_KEY);
  });

  it('si authStateReady nunca resuelve, el timeout permite la carga local (local-first)', async () => {
    jest.useFakeTimers();
    try {
      authMock.authStateReady.mockReturnValue(new Promise<void>(() => undefined));
      authMock.currentUser = null;

      const loadPromise = useProductivityStore.getState().loadState();
      await flush();
      expect(useProductivityStore.getState().stateLoaded).toBe(false);

      jest.advanceTimersByTime(4000);
      await flush();
      await loadPromise;

      expect(useProductivityStore.getState().stateLoaded).toBe(true);
      expect(await AsyncStorage.getItem(USER_KEY)).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('un authStateReady rechazado no bloquea la carga local', async () => {
    authMock.authStateReady.mockReturnValue(Promise.reject(new Error('auth no listo')));
    const loadPromise = useProductivityStore.getState().loadState();
    await loadPromise;
    expect(useProductivityStore.getState().stateLoaded).toBe(true);
    expect(await AsyncStorage.getItem(USER_KEY)).not.toBeNull();
  });
});

describe('handleAuthUserChanged', () => {
  it('no recarga cuando el uid coincide con el cargado', async () => {
    authMock.currentUser = makeUser('uid-a');
    await useProductivityStore.getState().loadState();
    const reloadSpy = jest.spyOn(useProductivityStore.getState(), 'reloadState');

    useProductivityStore.getState().handleAuthUserChanged('uid-a');

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('recarga cuando la sesión cambia a otro uid', async () => {
    authMock.currentUser = makeUser('uid-a');
    await useProductivityStore.getState().loadState();
    const reloadSpy = jest.spyOn(useProductivityStore.getState(), 'reloadState');

    authMock.currentUser = makeUser('uid-b');
    useProductivityStore.getState().handleAuthUserChanged('uid-b');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    await flush();

    expect(useProductivityStore.getState().stateLoaded).toBe(true);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(keyFor('uid-b'));
  });

  it('no hace nada si el estado aún no está cargado', async () => {
    useProductivityStore.setState({ stateLoaded: false });
    const reloadSpy = jest.spyOn(useProductivityStore.getState(), 'reloadState');

    useProductivityStore.getState().handleAuthUserChanged('uid-c');

    expect(reloadSpy).not.toHaveBeenCalled();
  });
});

describe('guard de saveState', () => {
  it('no persiste cuando el estado no está cargado (logout en vuelo)', async () => {
    useProductivityStore.setState({
      stateLoaded: false,
      goals: [
        {
          id: 'goal-1',
          title: 'Meta fantasma',
          deadline: '2026-09-10',
          progress: 0,
          milestones: [],
          completed: false,
          gravity: 'low',
          createdAt: '2026-09-08',
        },
      ],
    });

    await useProductivityStore.getState().saveState();

    expect(await AsyncStorage.getItem(USER_KEY)).toBeNull();
  });

  it('persiste cuando el estado sí está cargado', async () => {
    useProductivityStore.setState({
      stateLoaded: true,
      goals: [
        {
          id: 'goal-2',
          title: 'Meta real',
          deadline: '2026-09-10',
          progress: 0,
          milestones: [],
          completed: false,
          gravity: 'low',
          createdAt: '2026-09-08',
        },
      ],
    });

    await useProductivityStore.getState().saveState();

    const stored = await AsyncStorage.getItem(USER_KEY);
    expect(stored).not.toBeNull();
    expect(stored).toContain('goal-2');
  });
});
