import { useEngagementStore } from '../store/useEngagementStore';
import type { EngagementSlot } from '../model/engagementTypes';

const futureSlot = (): EngagementSlot => ({
  id: '2999-01-01:600',
  dayKey: '2999-01-01',
  startMinute: 600,
  status: 'planned',
  source: 'briefing',
});

describe('useEngagementStore', () => {
  it('descarta franjas planeadas futuras y sus hechos al cambiar el plan', async () => {
    await useEngagementStore.getState().loadState('store-cleanup-1');
    const slot = futureSlot();
    await useEngagementStore.getState().setSlotsFromPlan([slot]);
    await useEngagementStore.getState().recordScheduledFacts([slot.id]);
    expect(useEngagementStore.getState().slots).toHaveLength(1);
    expect(useEngagementStore.getState().facts).toHaveLength(1);

    // Nuevo plan vacío (cambio de cadencia o sin candidatos): no debe quedar
    // ni la franja ni su hecho, o el sobre fallaría validación al recargar.
    await useEngagementStore.getState().setSlotsFromPlan([]);
    expect(useEngagementStore.getState().slots).toHaveLength(0);
    expect(useEngagementStore.getState().facts).toHaveLength(0);
  });

  it('preserva franjas ya observadas aunque no estén en el plan', async () => {
    await useEngagementStore.getState().loadState('store-cleanup-2');
    const slot = futureSlot();
    await useEngagementStore.getState().setSlotsFromPlan([slot]);
    await useEngagementStore.getState().markOpened(slot.id);
    await useEngagementStore.getState().setSlotsFromPlan([]);

    const slots = useEngagementStore.getState().slots;
    expect(slots).toHaveLength(1);
    expect(slots[0].status).toBe('opened');
    expect(useEngagementStore.getState().facts.some((fact) => fact.kind === 'opened')).toBe(true);
  });

  it('reprogramar la misma franja es idempotente', async () => {
    await useEngagementStore.getState().loadState('store-cleanup-3');
    const slot = futureSlot();
    await useEngagementStore.getState().setSlotsFromPlan([slot]);
    await useEngagementStore.getState().recordScheduledFacts([slot.id]);
    await useEngagementStore.getState().setSlotsFromPlan([slot]);
    await useEngagementStore.getState().recordScheduledFacts([slot.id]);
    expect(useEngagementStore.getState().slots).toHaveLength(1);
    expect(useEngagementStore.getState().facts).toHaveLength(1);
  });
});
