const mockGoals = [
  {
    id: 'g1',
    title: 'Portafolio',
    progress: 40,
    completed: false,
    milestones: [{ id: 'm1', title: 'Ordenar', completed: false }],
  },
];
const mockHabits = [
  { id: 'h1', title: 'Leer', completed: false, frequency: 'daily' as const, streak: 4 },
];

jest.mock('@/shared/domain/productivity/public', () => ({
  useProductivityStore: { getState: () => ({ goals: mockGoals, habits: mockHabits }) },
  isHabitDueToday: () => true,
  localDateKey: (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`,
}));

jest.mock('@/shared/infrastructure/notifications', () => ({
  getNotificationPermission: jest.fn(async () => 'granted'),
  getScheduledNotificationIdentifiers: jest.fn(async () => []),
  cancelScheduledNotification: jest.fn(async () => undefined),
  scheduleLocalNotification: jest.fn(async () => undefined),
}));

jest.mock('@/shared/preferences/useSettingsStore', () => ({
  useSettingsStore: { getState: () => ({ language: 'es' }) },
}));

import {
  scheduleLocalNotification,
  cancelScheduledNotification,
  getScheduledNotificationIdentifiers,
} from '@/shared/infrastructure/notifications';
import { useEngagementStore } from '../store/useEngagementStore';
import { reconcileEngagement } from '../services/engagementReconciler';
import { ENGAGEMENT_ID_PREFIX } from '../model/slotPlanner';

const now = new Date(2026, 8, 8, 12, 0, 0); // martes mediodía

describe('engagementReconciler', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(getScheduledNotificationIdentifiers).mockResolvedValue([] as never);
    await useEngagementStore.getState().loadState(null);
  });

  it('programa franjas y persiste slots + hechos scheduled', async () => {
    await useEngagementStore.getState().updateProfile({ enabled: true, cadence: 'present' });
    const result = await reconcileEngagement({ now, horizonDays: 1 });

    expect(result.skipped).toBe(false);
    expect(result.scheduled).toBeGreaterThan(0);
    expect(scheduleLocalNotification).toHaveBeenCalled();
    const state = useEngagementStore.getState();
    expect(state.slots.length).toBe(result.slots);
    expect(state.facts.some((fact) => fact.kind === 'scheduled')).toBe(true);
  });

  it('es idempotente: re-reconciliar no duplica franjas ni hechos', async () => {
    await useEngagementStore.getState().updateProfile({ enabled: true, cadence: 'present' });
    await reconcileEngagement({ now, horizonDays: 1 });
    const firstSlots = useEngagementStore.getState().slots.length;
    const firstFacts = useEngagementStore.getState().facts.length;
    await reconcileEngagement({ now, horizonDays: 1 });
    expect(useEngagementStore.getState().slots.length).toBe(firstSlots);
    expect(useEngagementStore.getState().facts.length).toBe(firstFacts);
  });

  it('perfil apagado cancela la agenda del dominio', async () => {
    jest
      .mocked(getScheduledNotificationIdentifiers)
      .mockResolvedValue([`${ENGAGEMENT_ID_PREFIX}2026-09-01:600`] as never);
    await useEngagementStore.getState().updateProfile({ enabled: false });
    const result = await reconcileEngagement({ now, horizonDays: 1 });
    expect(result.scheduled).toBe(0);
    expect(result.cancelled).toBe(1);
  });

  it('no reconcilia antes de hidratar el estado', async () => {
    useEngagementStore.setState({ stateLoaded: false });
    const result = await reconcileEngagement({ now });
    expect(result.skipped).toBe(true);
  });

  it('consulta vieja no modifica franjas de la sesión nueva', async () => {
    await useEngagementStore.getState().loadState('old-query');
    await useEngagementStore.getState().updateProfile({ enabled: true });
    let release!: (identifiers: string[]) => void;
    const pending = new Promise<string[]>((resolve) => {
      release = resolve;
    });
    jest.mocked(getScheduledNotificationIdentifiers).mockReturnValueOnce(pending);
    const oldTask = reconcileEngagement({ now, horizonDays: 1 });
    await useEngagementStore.getState().loadState('new-query');
    release([]);
    expect((await oldTask).skipped).toBe(true);
    expect(useEngagementStore.getState().slots).toEqual([]);
    expect(scheduleLocalNotification).not.toHaveBeenCalled();
  });

  it('alerta vieja en vuelo se cancela antes de programar sesión nueva', async () => {
    await useEngagementStore.getState().loadState('old-sdk');
    await useEngagementStore.getState().updateProfile({ enabled: true });
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    jest.mocked(scheduleLocalNotification).mockImplementationOnce(async () => {
      entered();
      await pending;
    });
    const oldTask = reconcileEngagement({ now, horizonDays: 1 });
    await started;
    const oldIdentifier = jest.mocked(scheduleLocalNotification).mock.calls[0][0].identifier;
    await useEngagementStore.getState().loadState('new-sdk');
    await useEngagementStore.getState().updateProfile({ enabled: true });
    const newTask = reconcileEngagement({ now, horizonDays: 1 });
    release();
    expect((await oldTask).skipped).toBe(true);
    expect((await newTask).scheduled).toBeGreaterThan(0);
    expect(cancelScheduledNotification).toHaveBeenCalledWith(oldIdentifier);
    expect(jest.mocked(cancelScheduledNotification).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(scheduleLocalNotification).mock.invocationCallOrder[1],
    );
  });
});
