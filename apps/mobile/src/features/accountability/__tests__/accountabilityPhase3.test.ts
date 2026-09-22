import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/shared/infrastructure/notifications', () => ({
  getNotificationPermission: jest.fn(async () => 'granted'),
  getScheduledNotificationIdentifiers: jest.fn(async () => []),
  cancelScheduledNotification: jest.fn(async () => undefined),
  scheduleLocalNotification: jest.fn(async () => undefined),
}));

import { DEFAULT_PROFILE, EMPTY_ENVELOPE } from '../model/accountabilityTypes';
import { commitmentIdFor } from '../model/commitmentRules';
import { useAccountabilityStore } from '../store/useAccountabilityStore';
import { reconcileAccountability } from '../services/accountabilityReconciler';

const NOW = new Date(2026, 8, 8, 12, 0, 0);

const commitment = (overrides: Record<string, unknown> = {}) => ({
  id: 'acc:goal:g1',
  subjectType: 'goal' as const,
  subjectId: 'g1',
  enabled: true,
  intensity: 'firm' as const,
  nextAction: 'Ordenar imágenes',
  schedule: { kind: 'daily' as const, time: '19:00' },
  escalation: 'reschedule_or_minimum' as const,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
});

const seedEnabled = async (commitments = [commitment()]) => {
  const envelope = EMPTY_ENVELOPE('2026-09-01T00:00:00.000Z');
  await AsyncStorage.setItem(
    'sui-accountability-v1:user-1',
    JSON.stringify({
      ...envelope,
      profile: { ...DEFAULT_PROFILE, enabled: true, updatedAt: envelope.profile.updatedAt },
      commitments,
    }),
  );
  await useAccountabilityStore.getState().loadState('user-1');
};

describe('store: acciones de Fase 3', () => {
  beforeEach(async () => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    useAccountabilityStore.setState({
      profile: { ...DEFAULT_PROFILE, updatedAt: '' },
      commitments: [],
      cycles: [],
      facts: [],
      stateLoaded: false,
      activeCheckIn: null,
    });
  });

  it('updateCommitment edita agenda e intensidad', async () => {
    await seedEnabled();
    const result = await useAccountabilityStore.getState().updateCommitment('goal', 'g1', {
      schedule: { kind: 'weekly', days: ['sat'], time: '10:00' },
      intensity: 'demanding',
    });
    expect(result.outcome).toBe('saved');
    const [item] = useAccountabilityStore.getState().commitments;
    expect(item.schedule).toEqual({ kind: 'weekly', days: ['sat'], time: '10:00' });
    expect(item.intensity).toBe('demanding');
  });

  it('updateCommitment rechaza texto vacío y sujetos ajenos', async () => {
    await seedEnabled();
    const invalid = await useAccountabilityStore
      .getState()
      .updateCommitment('goal', 'g1', { nextAction: '  ' });
    expect(invalid.outcome).toBe('invalid');

    const missing = await useAccountabilityStore
      .getState()
      .updateCommitment('goal', 'fantasma', { intensity: 'soft' });
    expect(missing.outcome).toBe('not_found');
  });

  it('openCheckIn/closeCheckIn gestionan el estado del sheet', async () => {
    const store = useAccountabilityStore.getState();
    store.openCheckIn('acc:goal:g1', 'acc:goal:g1:2026-09-08');
    expect(useAccountabilityStore.getState().activeCheckIn).toEqual({
      commitmentId: 'acc:goal:g1',
      cycleId: 'acc:goal:g1:2026-09-08',
    });
    useAccountabilityStore.getState().closeCheckIn();
    expect(useAccountabilityStore.getState().activeCheckIn).toBeNull();
  });

  it('cambiar intensidad conserva ciclos y hechos', async () => {
    await seedEnabled();
    const commitmentId = commitmentIdFor('goal', 'g1');
    const cycleId = `${commitmentId}:2026-09-08`;
    useAccountabilityStore.setState({
      cycles: [
        {
          id: cycleId,
          commitmentId,
          localDate: '2026-09-08',
          time: '19:00',
          status: 'completed',
          attemptCount: 1,
          resolution: 'completed',
        },
      ],
      facts: [
        {
          id: 'fact-1',
          cycleId,
          kind: 'completed',
          occurredAt: '2026-09-08T20:00:00.000Z',
          source: 'app',
        },
      ],
    });

    await useAccountabilityStore.getState().updateProfile({ defaultIntensity: 'demanding' });

    expect(useAccountabilityStore.getState()).toMatchObject({
      profile: { defaultIntensity: 'demanding' },
      cycles: [{ id: cycleId, status: 'completed' }],
      facts: [{ id: 'fact-1', cycleId }],
    });
  });
});

describe('reconciler: limpieza de huérfanos', () => {
  beforeEach(async () => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    useAccountabilityStore.setState({
      profile: { ...DEFAULT_PROFILE, updatedAt: '' },
      commitments: [],
      cycles: [],
      facts: [],
      stateLoaded: false,
      activeCheckIn: null,
    });
  });

  it('elimina compromisos cuyo sujeto ya no existe, con sus ciclos', async () => {
    await seedEnabled([
      commitment(),
      commitment({ id: commitmentIdFor('habit', 'h9'), subjectType: 'habit', subjectId: 'h9' }),
    ]);
    // El hábito h9 fue eliminado; la meta g1 sigue viva.
    const result = await reconcileAccountability({
      now: NOW,
      horizonDays: 2,
      subjectExists: (type, id) => (type === 'habit' ? false : id === 'g1'),
    });
    expect(result.commitmentsCleaned).toBe(1);
    const ids = useAccountabilityStore.getState().commitments.map((item) => item.id);
    expect(ids).toEqual(['acc:goal:g1']);
  });

  it('sin subjectExists no limpia nada (compatibilidad)', async () => {
    await seedEnabled();
    const result = await reconcileAccountability({ now: NOW, horizonDays: 1 });
    expect(result.commitmentsCleaned).toBe(0);
    expect(useAccountabilityStore.getState().commitments.length).toBe(1);
  });
});
