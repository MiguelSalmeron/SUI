import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/shared/infrastructure/notifications', () => ({
  getNotificationPermission: jest.fn(async () => 'granted'),
  getScheduledNotificationIdentifiers: jest.fn(async () => []),
  cancelScheduledNotification: jest.fn(async () => undefined),
  scheduleLocalNotification: jest.fn(async () => undefined),
}));

import {
  STALE_AFTER_DAYS,
  cycleClockEvents,
  reconcileAccountability,
} from '../services/accountabilityReconciler';
import { DEFAULT_PROFILE, EMPTY_ENVELOPE } from '../model/accountabilityTypes';
import { useAccountabilityStore } from '../store/useAccountabilityStore';

const NOW = new Date(2026, 8, 8, 12, 0, 0); // martes 2026-09-08 12:00 local

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

const cycle = (overrides: Record<string, unknown> = {}) => ({
  id: 'acc:goal:g1:2026-09-08',
  commitmentId: 'acc:goal:g1',
  localDate: '2026-09-08',
  time: '19:00',
  status: 'configured' as const,
  attemptCount: 0,
  ...overrides,
});

const seed = async (envelope = EMPTY_ENVELOPE('2026-09-01T00:00:00.000Z')) => {
  await AsyncStorage.setItem('sui-accountability-v1:user-1', JSON.stringify(envelope));
  await useAccountabilityStore.getState().loadState('user-1');
};

const enabledEnvelope = () => {
  const envelope = EMPTY_ENVELOPE('2026-09-01T00:00:00.000Z');
  return {
    ...envelope,
    profile: { ...DEFAULT_PROFILE, enabled: true, updatedAt: envelope.profile.updatedAt },
    commitments: [commitment()],
  };
};

describe('cycleClockEvents', () => {
  it('ventana futura configured → schedule', () => {
    expect(cycleClockEvents('configured', '2026-09-09', '19:00', NOW, '2026-09-08')).toEqual([
      { type: 'schedule' },
    ]);
  });

  it('ventana futura scheduled: sin eventos', () => {
    expect(cycleClockEvents('scheduled', '2026-09-09', '19:00', NOW, '2026-09-08')).toEqual([]);
  });

  it('ventana de hoy iniciada: configured → schedule + due', () => {
    const events = cycleClockEvents('configured', '2026-09-08', '11:00', NOW, '2026-09-08');
    expect(events).toEqual([{ type: 'schedule' }, { type: 'due' }]);
  });

  it('ventana viva de hoy en due: sin eventos', () => {
    expect(cycleClockEvents('due', '2026-09-08', '11:00', NOW, '2026-09-08')).toEqual([]);
  });

  it('día pasado: scheduled → overdue → unknown en frío (2 días sin evidencia)', () => {
    // Arranque en frío tras 2 días: no tiene sentido re-presionar overdue;
    // se degrada directo a unknown.
    expect(cycleClockEvents('scheduled', '2026-09-06', '19:00', NOW, '2026-09-08')).toEqual([
      { type: 'schedule' },
      { type: 'expire' },
      { type: 'stale' },
    ]);
    expect(cycleClockEvents('due', '2026-09-06', '19:00', NOW, '2026-09-08')).toEqual([
      { type: 'expire' },
      { type: 'stale' },
    ]);
    expect(
      cycleClockEvents('overdue', '2026-09-06', '19:00', NOW, '2026-09-08'),
    ).toEqual([{ type: 'stale' }]);
  });

  it('atraso reciente (hoy) overdue: sin eventos, la presión sigue dentro de límites', () => {
    expect(cycleClockEvents('overdue', '2026-09-08', '09:00', NOW, '2026-09-08')).toEqual([]);
  });

  it(`stale sólo tras ${STALE_AFTER_DAYS} días: overdue de ayer sigue overdue`, () => {
    expect(cycleClockEvents('overdue', '2026-09-07', '19:00', NOW, '2026-09-08')).toEqual([]);
  });

  it('estados terminales o progresados: sin eventos', () => {
    expect(cycleClockEvents('completed', '2026-09-06', '19:00', NOW, '2026-09-08')).toEqual([]);
    expect(cycleClockEvents('unknown', '2026-09-06', '19:00', NOW, '2026-09-08')).toEqual([]);
    expect(cycleClockEvents('in_progress', '2026-09-06', '19:00', NOW, '2026-09-08')).toEqual([]);
  });
});

describe('reconcileAccountability', () => {
  beforeEach(async () => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    useAccountabilityStore.setState({
      profile: { ...DEFAULT_PROFILE, updatedAt: '' },
      commitments: [],
      cycles: [],
      facts: [],
      stateLoaded: false,
    });
  });

  it('sin estado cargado: se salta sin tocar nada', async () => {
    const result = await reconcileAccountability({ now: NOW });
    expect(result.skipped).toBe(true);
  });

  it('perfil desactivado: cancela alertas del dominio y no crea ciclos', async () => {
    await seed();
    const result = await reconcileAccountability({ now: NOW });
    expect(result.skipped).toBe(false);
    expect(result.cyclesCreated).toBe(0);
    expect(result.cancelled).toBe(0); // agenda vacía en el mock
  });

  it('crea ciclos del horizonte y programa alertas', async () => {
    await seed(enabledEnvelope());
    const result = await reconcileAccountability({ now: NOW, horizonDays: 3 });
    expect(result.cyclesCreated).toBe(3); // hoy + 2 días futuros
    const state = useAccountabilityStore.getState();
    expect(state.cycles.length).toBe(3);
    expect(state.cycles.every((c) => c.id.startsWith('acc:goal:g1'))).toBe(true);
    expect(result.scheduled).toBeGreaterThan(0);
    // La ventana de hoy (19:00, futura a las 12:00) queda programada,
    // no vencida ni due.
    const todayCycle = state.cycles.find((c) => c.localDate === '2026-09-08');
    expect(todayCycle?.status).toBe('scheduled');
  });

  it('marca due la ventana de hoy ya iniciada', async () => {
    await seed(enabledEnvelope());
    const evening = new Date(2026, 8, 8, 19, 5, 0);
    await reconcileAccountability({ now: evening, horizonDays: 1 });
    const todayCycle = useAccountabilityStore
      .getState()
      .cycles.find((c) => c.localDate === '2026-09-08');
    expect(todayCycle?.status).toBe('due');
  });

  it('vence y degrada atrasos viejos: overdue → unknown sin dramatizar', async () => {
    const envelope = enabledEnvelope();
    envelope.cycles = [
      cycle({ localDate: '2026-09-05', id: 'acc:goal:g1:2026-09-05', status: 'overdue' }),
    ];
    await seed(envelope);
    const result = await reconcileAccountability({ now: NOW, horizonDays: 2 });
    // 3 días de atraso ≥ STALE_AFTER_DAYS → unknown (sin evidencia, sin presión).
    const old = useAccountabilityStore
      .getState()
      .cycles.find((c) => c.id === 'acc:goal:g1:2026-09-05');
    expect(old?.status).toBe('unknown');
    expect(result.cyclesStaled).toBe(1);
  });

  it('es idempotente: segunda corrida no crea ni duplica', async () => {
    await seed(enabledEnvelope());
    const first = await reconcileAccountability({ now: NOW, horizonDays: 2 });
    const second = await reconcileAccountability({ now: NOW, horizonDays: 2 });
    expect(second.cyclesCreated).toBe(0);
    expect(useAccountabilityStore.getState().cycles.length).toBe(2);
    expect(second.scheduled).toBe(first.scheduled);
  });

  it('no programa nada si el permiso no está concedido', async () => {
    const { getNotificationPermission } = jest.requireMock('@/shared/infrastructure/notifications');
    getNotificationPermission.mockResolvedValueOnce('denied');
    await seed(enabledEnvelope());
    const result = await reconcileAccountability({ now: NOW, horizonDays: 2 });
    expect(result.scheduled).toBe(0);
  });
});
