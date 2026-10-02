import { buildAmbientCandidates } from '../model/ambientCatalog';
import { ENGAGEMENT_ID_PREFIX, planEngagement } from '../model/slotPlanner';
import { DEFAULT_ENGAGEMENT_PROFILE, type EngagementProfile } from '../model/engagementTypes';

const profile = (overrides: Partial<EngagementProfile> = {}): EngagementProfile => ({
  ...DEFAULT_ENGAGEMENT_PROFILE,
  enabled: true,
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
});

const now = new Date(2026, 8, 8, 12, 0, 0); // martes 2026-09-08, mediodía

const candidates = buildAmbientCandidates({
  goals: [
    { id: 'g1', title: 'Portafolio', progress: 40, pendingMilestones: 1 },
    { id: 'g2', title: 'Curso', progress: 10, pendingMilestones: 2 },
  ],
  habitsDue: [{ id: 'h1', title: 'Leer', streak: 4 }],
  hasActivity: false,
});

describe('slotPlanner', () => {
  it('usa IDs estables y es idempotente al re-ejecutar', () => {
    const input = {
      profile: profile({ cadence: 'present' }),
      now,
      candidatesToday: candidates,
      candidatesFuture: candidates,
      scheduledIdentifiers: [],
      horizonDays: 1,
    };
    const first = planEngagement(input);
    const second = planEngagement(input);
    expect(first.alerts.length).toBeGreaterThan(0);
    expect(second.alerts.map((a) => a.identifier)).toEqual(first.alerts.map((a) => a.identifier));
    for (const alert of first.alerts) {
      expect(alert.identifier.startsWith(ENGAGEMENT_ID_PREFIX)).toBe(true);
      expect(alert.fireAt.getTime()).toBeGreaterThan(now.getTime());
    }
    // Cada candidato se usa una sola vez al día.
    expect(new Set(first.slots.map((slot) => slot.id)).size).toBe(first.slots.length);
  });

  it('respeta el techo diario configurado', () => {
    const plan = planEngagement({
      profile: profile({ cadence: 'demanding', maxNotificationsPerDay: 2 }),
      now,
      candidatesToday: candidates,
      candidatesFuture: candidates,
      scheduledIdentifiers: [],
      horizonDays: 1,
    });
    expect(plan.alerts.length).toBeLessThanOrEqual(2);
  });

  it('con relleno apagado solo usa señal real (priority alta)', () => {
    const ambientOnly = buildAmbientCandidates({
      goals: [{ id: 'g1', title: 'Portafolio', progress: 0, pendingMilestones: 0 }],
      habitsDue: [],
      hasActivity: true,
    });
    const plan = planEngagement({
      profile: profile({ cadence: 'present', fillAmbient: false }),
      now,
      candidatesToday: ambientOnly,
      candidatesFuture: [],
      scheduledIdentifiers: [],
      horizonDays: 1,
    });
    // briefing (50) y reflection (40) quedan fuera; goal_momentum (60) sí entra.
    expect(plan.alerts.map((alert) => alert.source)).toEqual(['goal_momentum']);
  });

  it('cancela solo las alertas vencidas del dominio', () => {
    const plan = planEngagement({
      profile: profile(),
      now,
      candidatesToday: candidates,
      candidatesFuture: candidates,
      scheduledIdentifiers: [
        `${ENGAGEMENT_ID_PREFIX}2026-09-01:600`,
        'sui-nightly-report',
        'sui-accountability:acc:goal:g1:2026-09-01:due',
      ],
      horizonDays: 1,
    });
    expect(plan.cancels).toEqual([`${ENGAGEMENT_ID_PREFIX}2026-09-01:600`]);
  });

  it('perfil apagado cancela todo el dominio sin programar', () => {
    const plan = planEngagement({
      profile: profile({ enabled: false }),
      now,
      candidatesToday: candidates,
      candidatesFuture: candidates,
      scheduledIdentifiers: [`${ENGAGEMENT_ID_PREFIX}2026-09-01:600`],
      horizonDays: 1,
    });
    expect(plan.alerts).toEqual([]);
    expect(plan.cancels).toEqual([`${ENGAGEMENT_ID_PREFIX}2026-09-01:600`]);
  });

  it('respeta días de descanso', () => {
    const plan = planEngagement({
      profile: profile({ cadence: 'present', restDays: ['tue'] }),
      now,
      candidatesToday: candidates,
      candidatesFuture: candidates,
      scheduledIdentifiers: [],
      horizonDays: 1,
    });
    expect(plan.alerts).toEqual([]);
  });
});
