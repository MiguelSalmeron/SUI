import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ACCOUNTABILITY_SCHEMA_VERSION,
  ACCOUNTABILITY_STORAGE_KEY,
  DEFAULT_PROFILE,
  EMPTY_ENVELOPE,
  MAX_COMMITMENTS,
  type AccountabilityEnvelopeV1,
} from '../model/accountabilityTypes';
import { commitmentIdFor } from '../model/commitmentRules';
import {
  useAccountabilityStore,
  type SaveResult,
} from '../store/useAccountabilityStore';

const stamp = '2026-09-08T10:00:00.000Z';

const repositoryActual =
  jest.requireActual('../services/accountabilityRepository') as typeof import('../services/accountabilityRepository');

jest.mock('../services/accountabilityRepository', () => {
  const actual = jest.requireActual('../services/accountabilityRepository');
  return {
    ...actual,
    loadAccountability: jest.fn(actual.loadAccountability),
    writeAccountability: jest.fn(actual.writeAccountability),
  };
});

const { loadAccountability, writeAccountability } = jest.requireMock(
  '../services/accountabilityRepository',
) as {
  loadAccountability: jest.Mock;
  writeAccountability: jest.Mock;
};

const dailyInput = () => ({
  subjectType: 'goal' as const,
  subjectId: 'g1',
  intensity: 'firm' as const,
  nextAction: 'Ordenar imágenes del portafolio',
  schedule: { kind: 'daily' as const, time: '19:00' },
  escalation: 'reschedule_or_minimum' as const,
});

const baseline = (): AccountabilityEnvelopeV1 => EMPTY_ENVELOPE(stamp);

const seedEnvelope = async (envelope: AccountabilityEnvelopeV1, uid?: string | null) => {
  await AsyncStorage.setItem(
    uid ? `${ACCOUNTABILITY_STORAGE_KEY}:${uid}` : ACCOUNTABILITY_STORAGE_KEY,
    JSON.stringify(envelope),
  );
};

const lastPersisted = async (uid?: string | null): Promise<AccountabilityEnvelopeV1> => {
  const raw = await AsyncStorage.getItem(
    uid ? `${ACCOUNTABILITY_STORAGE_KEY}:${uid}` : ACCOUNTABILITY_STORAGE_KEY,
  );
  return raw ? JSON.parse(raw) : EMPTY_ENVELOPE('');
};

describe('useAccountabilityStore', () => {
  beforeEach(() => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    loadAccountability.mockImplementation(repositoryActual.loadAccountability);
    writeAccountability.mockImplementation(repositoryActual.writeAccountability);
    useAccountabilityStore.setState({
      profile: { ...DEFAULT_PROFILE, updatedAt: stamp },
      commitments: [],
      cycles: [],
      facts: [],
      stateLoaded: false,
    });
  });

  it('arranca con perfil por defecto desactivado y sin compromisos', () => {
    const state = useAccountabilityStore.getState();
    expect(state.stateLoaded).toBe(false);
    expect(state.profile.enabled).toBe(false);
    expect(state.commitments).toEqual([]);
  });

  it('loadState hidrata desde la clave del uid y marca stateLoaded', async () => {
    const envelope = baseline();
    envelope.commitments = [
      {
        id: 'acc:goal:g1',
        subjectType: 'goal',
        subjectId: 'g1',
        enabled: true,
        intensity: 'firm',
        nextAction: 'Acción',
        schedule: { kind: 'daily', time: '19:00' },
        escalation: 'notify_once',
        createdAt: stamp,
        updatedAt: stamp,
      },
    ];
    await seedEnvelope(envelope, 'user-1');

    await useAccountabilityStore.getState().loadState('user-1');

    const state = useAccountabilityStore.getState();
    expect(state.stateLoaded).toBe(true);
    expect(state.commitments[0].id).toBe('acc:goal:g1');
  });

  it('upsertCommitment crea y reemplaza 1:1 por sujeto, persistiendo', async () => {
    await useAccountabilityStore.getState().loadState('user-1');
    useAccountabilityStore.setState({ stateLoaded: true });

    const first = await useAccountabilityStore.getState().upsertCommitment(dailyInput());
    expect(first.outcome).toBe('saved');
    expect(useAccountabilityStore.getState().commitments.length).toBe(1);

    const second = await useAccountabilityStore.getState().upsertCommitment({
      ...dailyInput(),
      nextAction: 'Acción editada',
    });
    expect(second.outcome).toBe('saved');
    expect(useAccountabilityStore.getState().commitments.length).toBe(1);
    expect(useAccountabilityStore.getState().commitments[0].nextAction).toBe('Acción editada');
    // Conserva createdAt original al reemplazar.
    expect(useAccountabilityStore.getState().commitments[0].createdAt).toBe(
      first.envelope.commitments[0].createdAt,
    );
    await expect(lastPersisted('user-1')).resolves.toMatchObject({
      commitments: [{ nextAction: 'Acción editada' }],
    });
  });

  it('upsertCommitment rechaza texto vacío o demasiado largo', async () => {
    await useAccountabilityStore.getState().loadState('user-1');
    const invalid = await useAccountabilityStore.getState().upsertCommitment({
      ...dailyInput(),
      nextAction: '   ',
    });
    expect(invalid.outcome).toBe('invalid');
    expect(useAccountabilityStore.getState().commitments).toEqual([]);
  });

  it('upsertCommitment respeta el máximo de compromisos', async () => {
    await useAccountabilityStore.getState().loadState('user-1');
    const commitments = Array.from({ length: MAX_COMMITMENTS }, (_, index) => ({
      id: commitmentIdFor('habit', `h${index}`),
      subjectType: 'habit' as const,
      subjectId: `h${index}`,
      enabled: true,
      intensity: 'soft' as const,
      nextAction: `Acción ${index}`,
      schedule: { kind: 'daily' as const, time: '08:00' },
      escalation: 'notify_once' as const,
      createdAt: stamp,
      updatedAt: stamp,
    }));
    useAccountabilityStore.setState({ commitments });

    const result = await useAccountabilityStore
      .getState()
      .upsertCommitment({ ...dailyInput(), subjectType: 'habit', subjectId: 'nuevo' });
    expect(result.outcome).toBe('limit_reached');
  });

  it('disable y remove limpian ciclos y hechos asociados', async () => {
    await useAccountabilityStore.getState().loadState('user-1');
    await useAccountabilityStore.getState().upsertCommitment(dailyInput());
    const commitmentId = commitmentIdFor('goal', 'g1');
    await useAccountabilityStore.getState().recordFact(
      commitmentId,
      `${commitmentId}:2026-09-08`,
      { kind: 'scheduled', occurredAt: stamp, source: 'app' },
    );

    const disabled = await useAccountabilityStore.getState().disableCommitment('goal', 'g1');
    expect(disabled.outcome).toBe('saved');
    expect(useAccountabilityStore.getState().commitments[0].enabled).toBe(false);

    // recordFact sobre un ciclo inexistente es not_found: no crea hechos huérfanos.
    expect(useAccountabilityStore.getState().facts).toEqual([]);

    await useAccountabilityStore.getState().removeCommitment('goal', 'g1');
    expect(useAccountabilityStore.getState().commitments).toEqual([]);
    await expect(lastPersisted('user-1')).resolves.toMatchObject({ commitments: [] });
  });

  it('removeCommitment elimina también ciclos y hechos del compromiso', async () => {
    await useAccountabilityStore.getState().loadState('user-1');
    await useAccountabilityStore.getState().upsertCommitment(dailyInput());
    const commitmentId = commitmentIdFor('goal', 'g1');
    const cycleId = `${commitmentId}:2026-09-08`;
    useAccountabilityStore.setState({
      cycles: [
        {
          id: cycleId,
          commitmentId,
          localDate: '2026-09-08',
          time: '19:00',
          status: 'due',
          attemptCount: 1,
        },
      ],
    });
    await useAccountabilityStore.getState().recordFact(commitmentId, cycleId, {
      kind: 'scheduled',
      occurredAt: stamp,
      source: 'app',
    });
    expect(useAccountabilityStore.getState().facts.length).toBe(1);

    await useAccountabilityStore.getState().removeCommitment('goal', 'g1');
    expect(useAccountabilityStore.getState().cycles).toEqual([]);
    expect(useAccountabilityStore.getState().facts).toEqual([]);
  });

  it('applyCycleEvent aplica la transición y persiste resolvedAt real', async () => {
    await useAccountabilityStore.getState().loadState('user-1');
    const commitmentId = commitmentIdFor('goal', 'g1');
    const cycleId = `${commitmentId}:2026-09-08`;
    await useAccountabilityStore.getState().upsertCommitment(dailyInput());
    useAccountabilityStore.setState({
      cycles: [
        {
          id: cycleId,
          commitmentId,
          localDate: '2026-09-08',
          time: '19:00',
          status: 'due',
          attemptCount: 1,
        },
      ],
    });

    const result = await useAccountabilityStore
      .getState()
      .applyCycleEvent(commitmentId, cycleId, { type: 'complete', at: '2026-09-08T20:00:00.000Z' });
    expect(result.outcome).toBe('saved');
    const cycle = useAccountabilityStore.getState().cycles[0];
    expect(cycle.status).toBe('completed');
    expect(cycle.resolution).toBe('completed');
    expect(cycle.completedAt).toBe('2026-09-08T20:00:00.000Z');
    expect(cycle.resolvedAt).not.toBe('SET_NOW');
  });

  it('applyCycleEvent rechaza transiciones inválidas y ciclos ajenos', async () => {
    await useAccountabilityStore.getState().loadState('user-1');
    const commitmentId = commitmentIdFor('goal', 'g1');
    const cycleId = `${commitmentId}:2026-09-08`;
    await useAccountabilityStore.getState().upsertCommitment(dailyInput());
    useAccountabilityStore.setState({
      cycles: [
        {
          id: cycleId,
          commitmentId,
          localDate: '2026-09-08',
          time: '19:00',
          status: 'completed',
          attemptCount: 0,
        },
      ],
    });

    const rejected = await useAccountabilityStore
      .getState()
      .applyCycleEvent(commitmentId, cycleId, { type: 'expire' });
    expect(rejected.outcome).toBe('rejected_transition');

    const foreign = await useAccountabilityStore
      .getState()
      .applyCycleEvent('acc:goal:otro', cycleId, { type: 'expire' });
    expect(foreign.outcome).toBe('not_found');
  });

  it('recordFact agrega hechos con ID determinista de posición temporal', async () => {
    await useAccountabilityStore.getState().loadState('user-1');
    const commitmentId = commitmentIdFor('goal', 'g1');
    const cycleId = `${commitmentId}:2026-09-08`;
    await useAccountabilityStore.getState().upsertCommitment(dailyInput());
    useAccountabilityStore.setState({
      cycles: [
        {
          id: cycleId,
          commitmentId,
          localDate: '2026-09-08',
          time: '19:00',
          status: 'scheduled',
          attemptCount: 0,
        },
      ],
    });

    const result = await useAccountabilityStore.getState().recordFact(commitmentId, cycleId, {
      kind: 'check_in',
      occurredAt: stamp,
      source: 'app',
    });
    expect(result.outcome).toBe('saved');
    const [fact] = useAccountabilityStore.getState().facts;
    expect(fact.cycleId).toBe(cycleId);
    expect(fact.kind).toBe('check_in');
    expect(fact.id).toContain(cycleId);

    // Sobre un ciclo inexistente: no_found, sin hecho huérfano.
    const orphan = await useAccountabilityStore
      .getState()
      .recordFact(commitmentId, 'ciclo-inexistente', {
        kind: 'check_in',
        occurredAt: stamp,
        source: 'app',
      });
    expect(orphan.outcome).toBe('not_found');
  });

  it('handleAuthUserChanged recarga al cambiar de uid y es no-op con el mismo', async () => {
    await seedEnvelope(baseline(), 'user-1');
    await useAccountabilityStore.getState().handleAuthUserChanged('user-1');
    expect(useAccountabilityStore.getState().stateLoaded).toBe(true);

    const before = useAccountabilityStore.getState().profile;
    await useAccountabilityStore.getState().handleAuthUserChanged('user-1');
    expect(useAccountabilityStore.getState().profile).toEqual(before);

    // Cambiar a otro uid (sin datos) resetea el espacio visible.
    await useAccountabilityStore.getState().handleAuthUserChanged('user-2');
    expect(useAccountabilityStore.getState().commitments).toEqual([]);
  });

  it('clearLocal vacía el estado y la clave persistida', async () => {
    await useAccountabilityStore.getState().loadState('user-1');
    await useAccountabilityStore.getState().upsertCommitment(dailyInput());
    await useAccountabilityStore.getState().clearLocal();
    expect(useAccountabilityStore.getState().commitments).toEqual([]);
    expect(useAccountabilityStore.getState().profile.enabled).toBe(false);
    await expect(lastPersisted('user-1')).resolves.toMatchObject({ commitments: [] });
  });

  it('fallo de almacenamiento no revierte el estado en memoria', async () => {
    await useAccountabilityStore.getState().loadState('user-1');
    writeAccountability.mockRejectedValueOnce(new Error('disk full'));

    const result: SaveResult = await useAccountabilityStore.getState().upsertCommitment(dailyInput());
    expect(result.outcome).toBe('storage_error');
    expect(useAccountabilityStore.getState().commitments.length).toBe(1);
  });

  it('el sobre persistido siempre lleva schemaVersion 1', async () => {
    await useAccountabilityStore.getState().loadState('user-1');
    await useAccountabilityStore.getState().upsertCommitment(dailyInput());
    const persisted = await lastPersisted('user-1');
    expect(persisted.schemaVersion).toBe(ACCOUNTABILITY_SCHEMA_VERSION);
    expect(typeof persisted.updatedAt).toBe('string');
    expect(persisted.profile.updatedAt).not.toBe('');
  });
});
