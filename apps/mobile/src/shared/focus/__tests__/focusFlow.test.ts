import type { FocusTarget } from '../focusTypes';
import type { Goal, TimelineItem } from '@/shared/types/models';
import { nextFocusTarget, sameFocusTarget, timelineItemToFocusTarget } from '../focusFlow';

const goal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  title: 'Preparar proyecto',
  deadline: '2026-10-20',
  progress: 0,
  milestones: [
    { id: 'm1', title: 'Definir alcance', completed: false },
    { id: 'm2', title: 'Entregar', completed: false },
  ],
  completed: false,
  gravity: 'low',
  createdAt: '2026-10-01',
  ...overrides,
});

const item = (overrides: Partial<TimelineItem> = {}): TimelineItem => ({
  id: 'timeline-habit-h1',
  title: 'Leer',
  date: '2026-10-04',
  completed: false,
  origin: 'habit',
  originalId: 'h1',
  ...overrides,
});

describe('focusFlow', () => {
  it('compara objetivos por valor y no por referencia', () => {
    const a: FocusTarget = { kind: 'milestone', goalId: 'g1', milestoneId: 'm1' };
    const b: FocusTarget = { kind: 'milestone', goalId: 'g1', milestoneId: 'm1' };
    expect(sameFocusTarget(a, b)).toBe(true);
    expect(sameFocusTarget(a, { ...b, milestoneId: 'm2' })).toBe(false);
    expect(sameFocusTarget(a, { kind: 'habit', habitId: 'h1' })).toBe(false);
    expect(sameFocusTarget(null, null)).toBe(true);
    expect(sameFocusTarget(a, null)).toBe(false);
  });

  it('Enfocar desde hábito lleva el hábito real', () => {
    expect(timelineItemToFocusTarget(item(), [])).toEqual({ kind: 'habit', habitId: 'h1' });
  });

  it('Enfocar desde meta lleva el primer hito pendiente', () => {
    const target = timelineItemToFocusTarget(item({ origin: 'goal', originalId: 'g1' }), [goal()]);
    expect(target).toEqual({ kind: 'milestone', goalId: 'g1', milestoneId: 'm1' });
  });

  it('meta con hitos agotados enfoca la meta como primer paso', () => {
    const done = goal({ milestones: [{ id: 'm1', title: 'Listo', completed: true }] });
    expect(timelineItemToFocusTarget(item({ origin: 'goal', originalId: 'g1' }), [done])).toEqual({
      kind: 'goal',
      goalId: 'g1',
    });
  });

  it('calendario y metas ausentes no tienen objetivo (sesión libre segura)', () => {
    expect(
      timelineItemToFocusTarget(item({ origin: 'google_calendar', originalId: 'e1' }), [goal()]),
    ).toBeNull();
    expect(
      timelineItemToFocusTarget(item({ origin: 'goal', originalId: 'ausente' }), [goal()]),
    ).toBeNull();
  });

  it('siguiente paso salta el actual sin reordenar', () => {
    const steps = [
      { target: { kind: 'habit', habitId: 'h1' } as FocusTarget },
      { target: { kind: 'milestone', goalId: 'g1', milestoneId: 'm1' } as FocusTarget },
    ];
    expect(nextFocusTarget(steps, null)).toEqual(steps[0]!.target);
    expect(nextFocusTarget(steps, steps[0]!.target)).toEqual(steps[1]!.target);
    expect(nextFocusTarget(steps, steps[1]!.target)).toEqual(steps[0]!.target);
    expect(nextFocusTarget([], steps[0]!.target)).toBeNull();
  });
});
