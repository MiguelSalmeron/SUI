import {
  OVERDUE_REISSUE_GRACE_MINUTES,
  PREPARE_LEAD_MINUTES,
  DAILY_DIGEST_MINUTE,
  planNotifications,
} from '../model/notificationPlan';
import { DEFAULT_PROFILE, MAX_COMMITMENTS } from '../model/accountabilityTypes';
import type { AccountabilityProfile } from '../model/accountabilityTypes';

const NOW = new Date(2026, 8, 8, 12, 0, 0); // martes 2026-09-08 12:00 local

const profile = (overrides: Partial<AccountabilityProfile> = {}) => ({
  ...DEFAULT_PROFILE,
  updatedAt: '2026-09-01T00:00:00.000Z',
  enabled: true,
  ...overrides,
});

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

const baseInput = (overrides: Record<string, unknown> = {}) => ({
  profile: profile(),
  commitments: [commitment()],
  cycles: [],
  now: NOW,
  permission: 'granted' as const,
  scheduledIdentifiers: [] as string[],
  ...overrides,
});

const identifiers = (plan: ReturnType<typeof planNotifications>) =>
  plan.alerts.map((alert) => alert.identifier);

describe('planNotifications', () => {
  it('perfil desactivado: plan vacío y cancelación de toda la agenda previa', () => {
    const plan = planNotifications(
      baseInput({
        profile: profile({ enabled: false }),
        scheduledIdentifiers: ['sui-accountability:a:1:due', 'sui-nightly-report'],
      }),
    );
    expect(plan.alerts).toEqual([]);
    // Sólo cancela lo del dominio; nunca lo ajeno.
    expect(plan.cancels).toEqual(['sui-accountability:a:1:due']);
  });

  it('sin permiso: plan vacío y cancelaciones', () => {
    const plan = planNotifications(
      baseInput({ permission: 'denied', scheduledIdentifiers: ['sui-accountability:x:y:due'] }),
    );
    expect(plan.alerts).toEqual([]);
    expect(plan.cancels).toEqual(['sui-accountability:x:y:due']);
  });

  it('genera prepare/due/check_in futuros con horas correctas', () => {
    const plan = planNotifications(baseInput());
    // now=12:00, ventana 19:00 → prepare 18:40 de hoy y todo el horizonte futuro.
    const first = plan.alerts[0];
    expect(first.stage).toBe('prepare');
    // 19:00 − 20 min = 18:40.
    expect(first.fireAt.getHours()).toBe(18);
    expect(first.fireAt.getMinutes()).toBe(60 - PREPARE_LEAD_MINUTES);
    expect(identifiers(plan)).toContain('sui-accountability:acc:goal:g1:2026-09-08:prepare');
    expect(identifiers(plan)).toContain('sui-accountability:acc:goal:g1:2026-09-08:due');
    expect(identifiers(plan)).toContain('sui-accountability:acc:goal:g1:2026-09-08:check_in');
  });

  it('es determinista: mismo input ⇒ mismo plan', () => {
    const input = baseInput({
      cycles: [cycle(), cycle({ localDate: '2026-09-09', id: 'acc:goal:g1:2026-09-09' })],
      scheduledIdentifiers: ['sui-accountability:acc:goal:g1:2026-09-08:due'],
    });
    expect(planNotifications(input)).toEqual(planNotifications(input));
  });

  it('respetas el máximo diario de avisos', () => {
    const plan = planNotifications(baseInput({ profile: profile({ maxNotificationsPerDay: 2 }) }));
    const todayAlerts = plan.alerts.filter(
      (alert) =>
        alert.fireAt.getFullYear() === 2026 &&
        alert.fireAt.getMonth() === 8 &&
        alert.fireAt.getDate() === 8,
    );
    expect(todayAlerts.length).toBe(2);
  });

  it('no alerta en quiet hours (12:00–20:00) y respeta días de descanso', () => {
    // La ventana 19:00 cae dentro de 12:00–20:00 quiet → ninguna alerta.
    const quietPlan = planNotifications(
      baseInput({ profile: profile({ quietHours: { startMinute: 12 * 60, endMinute: 20 * 60 } }) }),
    );
    expect(quietPlan.alerts).toEqual([]);

    // Martes = día de descanso: no hay alertas del martes; el resto de la
    // semana (miércoles en adelante) sigue generando avisos.
    const restPlan = planNotifications(baseInput({ profile: profile({ restDays: ['tue'] }) }));
    expect(restPlan.alerts.length).toBeGreaterThan(0);
    expect(restPlan.alerts.every((alert) => alert.fireAt.getDay() !== 2)).toBe(true);
  });

  it('compromiso deshabilitado o sin etapa activa no genera alertas', () => {
    const disabled = planNotifications(
      baseInput({ commitments: [commitment({ enabled: false })] }),
    );
    expect(disabled.alerts).toEqual([]);

    // Ciclo completado hoy: no más alertas para ese día.
    const completed = planNotifications(
      baseInput({ cycles: [cycle({ status: 'completed', resolution: 'completed' })] }),
    );
    expect(identifiers(completed)).not.toContain('sui-accountability:acc:goal:g1:2026-09-08:due');
  });

  it('overdue re-emite lo antes posible, nunca en el pasado', () => {
    // Ventana de hoy a las 11:00 (ya pasó al ser 12:00), ciclo overdue.
    const plan = planNotifications(
      baseInput({
        commitments: [commitment({ schedule: { kind: 'daily', time: '11:00' } })],
        cycles: [cycle({ time: '11:00', status: 'overdue' })],
      }),
    );
    const overdue = plan.alerts.filter((alert) => alert.stage === 'overdue');
    expect(overdue.length).toBeGreaterThan(0);
    expect(overdue[0].fireAt.getTime()).toBeGreaterThan(NOW.getTime());
    // Re-emisión: max(check-in 11:45, gracia 12:05) = 12:05.
    expect(overdue[0].fireAt.getTime()).toBe(
      NOW.getTime() + OVERDUE_REISSUE_GRACE_MINUTES * 60_000,
    );
  });

  it('cancela sólo los identificadores del dominio que ya no están planeados', () => {
    // Ventana 09:00: a las 12:00 su prepare/due/check_in de hoy ya pasaron y
    // no se regeneran, así que el prepare sembrado debe cancelarse.
    const plan = planNotifications(
      baseInput({
        commitments: [commitment({ schedule: { kind: 'daily', time: '09:00' } })],
        scheduledIdentifiers: [
          'sui-accountability:acc:goal:g1:2026-09-08:prepare',
          'sui-accountability:acc:goal:otro:2026-09-09:due',
          'sui-nightly-report',
        ],
      }),
    );
    expect(plan.cancels).toContain('sui-accountability:acc:goal:otro:2026-09-09:due');
    expect(plan.cancels).toContain('sui-accountability:acc:goal:g1:2026-09-08:prepare');
    expect(plan.cancels).not.toContain('sui-nightly-report');
  });

  it('agenda digest diario determinista con conteos agregados', () => {
    const plan = planNotifications(
      baseInput({
        cycles: [
          cycle({ status: 'completed', resolution: 'completed' }),
          cycle({ id: 'acc:goal:g2:2026-09-08', commitmentId: 'acc:goal:g2', status: 'unknown' }),
        ],
      }),
    );
    const digest = plan.alerts.find((alert) => alert.kind === 'digest');
    expect(digest).toMatchObject({
      identifier: 'sui-accountability:digest:daily:2026-09-08:review',
      period: 'daily',
      summary: { completed: 1, unknown: 1, total: 2 },
    });
    expect(digest?.fireAt.getHours()).toBe(Math.floor(DAILY_DIGEST_MINUTE / 60));
  });

  it('domingo usa digest semanal si está activo', () => {
    const sunday = new Date(2026, 8, 13, 12, 0, 0);
    const plan = planNotifications(
      baseInput({
        now: sunday,
        commitments: [],
        cycles: [cycle({ localDate: '2026-09-07', status: 'rescheduled' })],
      }),
    );
    expect(plan.alerts).toEqual([
      expect.objectContaining({
        kind: 'digest',
        period: 'weekly',
        summary: expect.objectContaining({ rescheduled: 1 }),
      }),
    ]);
  });

  it('simula MAX_COMMITMENTS sin superar límite diario ni duplicar IDs', () => {
    const commitments = Array.from({ length: MAX_COMMITMENTS }, (_, index) =>
      commitment({
        id: `acc:goal:g${index}`,
        subjectId: `g${index}`,
        schedule: { kind: 'daily', time: '19:00' },
      }),
    );
    const plan = planNotifications(baseInput({ commitments }));
    const perDay = new Map<string, number>();
    for (const alert of plan.alerts) {
      const key = `${alert.fireAt.getFullYear()}-${alert.fireAt.getMonth()}-${alert.fireAt.getDate()}`;
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    expect(
      [...perDay.values()].every((count) => count <= DEFAULT_PROFILE.maxNotificationsPerDay),
    ).toBe(true);
    expect(new Set(identifiers(plan)).size).toBe(plan.alerts.length);
    const perCycle = new Map<string, number>();
    for (const alert of plan.alerts) {
      if (alert.kind !== 'commitment') continue;
      perCycle.set(alert.cycleId, (perCycle.get(alert.cycleId) ?? 0) + 1);
    }
    expect([...perCycle.values()].every((count) => count <= 3)).toBe(true);
    expect(planNotifications(baseInput({ commitments: [...commitments].reverse() }))).toEqual(plan);
  });

  it('reserva cupo diario para digest sin romper límite', () => {
    const commitments = Array.from({ length: MAX_COMMITMENTS }, (_, index) =>
      commitment({ id: `acc:goal:g${index}`, subjectId: `g${index}` }),
    );
    const plan = planNotifications(
      baseInput({
        commitments,
        cycles: [cycle({ status: 'completed', resolution: 'completed' })],
      }),
    );
    const today = plan.alerts.filter((alert) => alert.fireAt.getDate() === 8);
    expect(today).toHaveLength(DEFAULT_PROFILE.maxNotificationsPerDay);
    expect(today.some((alert) => alert.kind === 'digest')).toBe(true);
  });

  it('separa alertas overdue globales por enfriamiento', () => {
    const commitments = Array.from({ length: MAX_COMMITMENTS }, (_, index) =>
      commitment({
        id: `acc:goal:g${index}`,
        subjectId: `g${index}`,
        schedule: { kind: 'daily', time: '11:00' },
      }),
    );
    const cycles = commitments.map((item) =>
      cycle({
        id: `${item.id}:2026-09-08`,
        commitmentId: item.id,
        time: '11:00',
        status: 'overdue',
      }),
    );
    const overdue = planNotifications(baseInput({ commitments, cycles })).alerts.filter(
      (alert) => alert.stage === 'overdue',
    );
    expect(overdue).toHaveLength(1);
  });
});
