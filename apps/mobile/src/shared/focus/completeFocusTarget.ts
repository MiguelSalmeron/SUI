import { useProductivityStore } from '@/shared/domain/productivity/public';
import type { FocusTarget } from './focusTypes';

export type CompleteResult = 'completed' | 'already_done' | 'missing' | 'not_completable';

export function resolveFocusTarget(
  target: FocusTarget,
): { status: 'pending' | 'done'; title: string; parentTitle?: string } | { status: 'missing' } {
  const { goals, habits } = useProductivityStore.getState();
  if (target.kind === 'habit') {
    const habit = habits.find((item) => item.id === target.habitId);
    if (!habit) return { status: 'missing' };
    return { status: habit.completed ? 'done' : 'pending', title: habit.title };
  }
  const goal = goals.find((item) => item.id === target.goalId);
  if (!goal) return { status: 'missing' };
  if (target.kind === 'goal') {
    return { status: goal.completed ? 'done' : 'pending', title: goal.title };
  }
  const milestone = goal.milestones.find((item) => item.id === target.milestoneId);
  if (!milestone) return { status: 'missing' };
  return {
    status: goal.completed || milestone.completed ? 'done' : 'pending',
    title: milestone.title,
    parentTitle: goal.title,
  };
}

export function completeFocusTarget(target: FocusTarget): CompleteResult {
  const resolved = resolveFocusTarget(target);
  if (resolved.status === 'missing') return 'missing';
  if (resolved.status === 'done') return 'already_done';
  const state = useProductivityStore.getState();
  if (target.kind === 'milestone') {
    state.toggleMilestone(target.goalId, target.milestoneId);
  } else if (target.kind === 'habit') {
    state.toggleHabit(target.habitId);
  } else {
    return 'not_completable';
  }
  return 'completed';
}
