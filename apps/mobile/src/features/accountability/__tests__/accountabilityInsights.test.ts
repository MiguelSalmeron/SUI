import type { FollowUpCycle, FollowUpFact } from '../model/accountabilityTypes';
import {
  computeAccountabilityDigest,
  computeAccountabilityPatterns,
} from '../model/accountabilityInsights';

const cycle = (
  id: string,
  localDate: string,
  status: FollowUpCycle['status'],
  overrides: Partial<FollowUpCycle> = {},
): FollowUpCycle => ({
  id,
  commitmentId: 'acc:goal:g1',
  localDate,
  time: '19:00',
  status,
  attemptCount: 1,
  ...overrides,
});

describe('accountability insights', () => {
  it('resume ciclos por rango sin contar estados sin resultado', () => {
    const cycles = [
      cycle('c1', '2026-09-08', 'completed'),
      cycle('c2', '2026-09-08', 'overdue'),
      cycle('c3', '2026-09-08', 'unknown'),
      cycle('c4', '2026-09-08', 'rescheduled'),
      cycle('c5', '2026-09-08', 'scheduled'),
      cycle('c6', '2026-09-07', 'completed'),
    ];

    expect(computeAccountabilityDigest(cycles, '2026-09-08', '2026-09-08')).toEqual({
      completed: 1,
      overdue: 1,
      unknown: 1,
      rescheduled: 1,
      total: 4,
    });
  });

  it('agrega hora completada y día reprogramado desde ciclos y hechos', () => {
    const cycles = [
      cycle('c1', '2026-09-07', 'completed', { completedAt: '2026-09-07T09:10:00' }),
      cycle('c2', '2026-09-08', 'due'),
      cycle('c3', '2026-09-07', 'rescheduled'),
      cycle('c4', '2026-09-07', 'due'),
    ];
    const facts: FollowUpFact[] = [
      {
        id: 'f1',
        cycleId: 'c2',
        kind: 'completed',
        occurredAt: '2026-09-08T09:40:00',
        source: 'app',
      },
      {
        id: 'f2',
        cycleId: 'c4',
        kind: 'rescheduled',
        occurredAt: '2026-09-07T20:00:00',
        source: 'app',
      },
    ];

    expect(computeAccountabilityPatterns(cycles, facts)).toEqual({
      completionSamples: 2,
      rescheduledCycles: 2,
      preferredCompletionHour: 9,
      mostRescheduledDay: 'mon',
    });
  });

  it('resuelve empates de forma determinista', () => {
    const cycles = [
      cycle('c1', '2026-09-08', 'completed', { completedAt: '2026-09-08T18:00:00' }),
      cycle('c2', '2026-09-07', 'completed', { completedAt: '2026-09-07T08:00:00' }),
    ];
    expect(computeAccountabilityPatterns(cycles, []).preferredCompletionHour).toBe(8);
  });
});
