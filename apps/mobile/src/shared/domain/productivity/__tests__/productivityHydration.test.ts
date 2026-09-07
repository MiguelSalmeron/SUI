jest.mock('@/shared/observability/telemetry', () => ({ recordTelemetry: jest.fn() }));

import type { User } from 'firebase/auth';

let resolveSync: (result: any) => void;
const mockSyncPromise = () =>
  new Promise((resolve) => {
    resolveSync = resolve;
  });

jest.mock('@/shared/infrastructure/firebase/firebase', () => ({
  auth: {
    currentUser: {
      uid: 'user-google-1',
      isAnonymous: false,
      providerData: [{ providerId: 'google.com' }],
    } as unknown as User,
  },
}));

jest.mock('@/shared/account/useIntroStore', () => ({
  useIntroStore: {
    getState: () => ({
      syncEnabled: true,
      registerAccount: jest.fn(),
    }),
  },
}));

jest.mock('../sync/syncCoordinator', () => ({
  synchronizeProductivity: jest.fn(() => mockSyncPromise()),
  pullCloudProductivity: jest.fn(),
}));

import { useProductivityStore } from '../store/useProductivityStore';

describe('productivity store hydration lifecycle', () => {
  beforeEach(() => {
    useProductivityStore.setState({
      stateLoaded: false,
      goals: [],
      habits: [],
      streak: 0,
      totalXp: 0,
      syncStatus: 'local',
    });
    jest.clearAllMocks();
  });

  it('no expone stateLoaded=true antes de completar el bootstrap cloud para usuario autenticado', async () => {
    const store = useProductivityStore.getState();
    const loadPromise = store.loadState();

    // Permitir que complete la lectura local asíncrona
    await new Promise((r) => setTimeout(r, 20));

    // Mientras el sync/bootstrap está en vuelo, stateLoaded NO debe ser true
    expect(useProductivityStore.getState().stateLoaded).toBe(false);

    // Resolver el bootstrap de la nube
    resolveSync({
      data: {
        goals: [],
        habits: [
          {
            id: 'habit-cloud',
            title: 'Hábito Cloud',
            completed: false,
            frequency: 'daily',
            streak: 5,
            createdAt: '2026-09-01',
          },
        ],
        weeklyHistory: [],
        streakCount: 5,
        totalXp: 150,
      },
      metadata: {},
      summaryMeta: null,
      pullState: { syncEpoch: 1, cursors: { goals: null, habits: null, snapshots: null }, needsBootstrap: false, needsRebase: false },
      lastSyncedAt: '2026-09-01T12:00:00.000Z',
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

    await loadPromise;

    // Ahora que el bootstrap terminó, stateLoaded sí debe ser true y con los datos de la nube
    expect(useProductivityStore.getState().stateLoaded).toBe(true);
    expect(useProductivityStore.getState().habits[0]?.title).toBe('Hábito Cloud');
  });
});
