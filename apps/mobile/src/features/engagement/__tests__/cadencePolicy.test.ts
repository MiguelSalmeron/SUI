import {
  activeRanges,
  adaptCadence,
  computeCadenceStats,
  slotMinutesFor,
} from '../model/cadencePolicy';
import type { EngagementFact, EngagementSlot } from '../model/engagementTypes';

describe('cadencePolicy', () => {
  it('deriva la ventana activa como complemento de quiet hours', () => {
    expect(activeRanges({ startMinute: 22 * 60, endMinute: 7 * 60 })).toEqual([
      { startMinute: 7 * 60, endMinute: 22 * 60 },
    ]);
    // Sin horas protegidas el día completo queda activo.
    expect(activeRanges({ startMinute: 0, endMinute: 0 })).toEqual([
      { startMinute: 0, endMinute: 24 * 60 },
    ]);
    // Franja protegida en medio del día: activo antes y después.
    expect(activeRanges({ startMinute: 12 * 60, endMinute: 14 * 60 })).toEqual([
      { startMinute: 0, endMinute: 12 * 60 },
      { startMinute: 14 * 60, endMinute: 24 * 60 },
    ]);
  });

  it('present y demanding alcanzan franjas de una hora o menos', () => {
    expect(slotMinutesFor('present')).toBe(60);
    expect(slotMinutesFor('demanding')).toBeLessThanOrEqual(60);
  });

  it('sube la cadencia con buena respuesta y la baja con fatiga', () => {
    expect(adaptCadence('calm', { scheduled: 20, engaged: 12 }, true)).toBe('steady');
    expect(adaptCadence('present', { scheduled: 20, engaged: 1 }, true)).toBe('steady');
    expect(adaptCadence('demanding', { scheduled: 30, engaged: 25 }, true)).toBe('demanding');
  });

  it('no adapta sin señal suficiente ni cuando está apagada', () => {
    expect(adaptCadence('calm', { scheduled: 5, engaged: 5 }, true)).toBe('calm');
    expect(adaptCadence('calm', { scheduled: 30, engaged: 30 }, false)).toBe('calm');
  });

  it('cuenta solo franjas ya alcanzadas por el reloj', () => {
    const slots: EngagementSlot[] = [
      { id: '2026-09-08:600', dayKey: '2026-09-08', startMinute: 600, status: 'opened' },
      { id: '2026-09-08:1200', dayKey: '2026-09-08', startMinute: 1200, status: 'planned' },
      { id: '2026-09-09:600', dayKey: '2026-09-09', startMinute: 600, status: 'planned' },
    ];
    const facts: EngagementFact[] = [
      {
        id: 'a:scheduled',
        slotId: '2026-09-08:600',
        kind: 'scheduled',
        occurredAt: '2026-09-08T10:00:00.000Z',
        source: 'system_reconcile',
      },
      {
        id: 'a:opened',
        slotId: '2026-09-08:600',
        kind: 'opened',
        occurredAt: '2026-09-08T10:05:00.000Z',
        source: 'notification',
      },
      {
        id: 'fut:scheduled',
        slotId: '2026-09-08:1200',
        kind: 'scheduled',
        occurredAt: '2026-09-08T10:00:00.000Z',
        source: 'system_reconcile',
      },
      {
        id: 'b:scheduled',
        slotId: '2026-09-09:600',
        kind: 'scheduled',
        occurredAt: '2026-09-08T10:00:00.000Z',
        source: 'system_reconcile',
      },
    ];
    // nowMinute 700: la franja de las 10:00 cuenta; la de las 20:00 de hoy y la
    // de mañana no deben inflar el denominador.
    expect(computeCadenceStats(slots, facts, '2026-09-08', 700)).toEqual({
      scheduled: 1,
      engaged: 1,
    });
  });
});
