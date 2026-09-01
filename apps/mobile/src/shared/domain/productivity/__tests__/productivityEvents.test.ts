jest.mock('@/shared/infrastructure/firebase/firebase', () => ({
  auth: { currentUser: null },
}));
jest.mock('@/shared/observability/telemetry', () => ({ recordTelemetry: jest.fn() }));

import { appEventBus } from '@/shared/events/appEventBus';
import { useProductivityStore } from '../store/useProductivityStore';

const goal = {
  id: 'goal-1',
  title: 'Goal',
  deadline: '2026-09-01',
  progress: 0,
  milestones: [{ id: 'milestone-1', title: 'Step', completed: false }],
  impactDays: [],
  completed: false,
  gravity: 'low' as const,
  createdAt: '2026-09-01',
};

const habit = {
  id: 'habit-1',
  title: 'Habit',
  completed: false,
  frequency: 'daily' as const,
  streak: 0,
  createdAt: '2026-09-01',
};

describe('productivity completion events', () => {
  beforeEach(() => {
    useProductivityStore.setState({ goals: [goal], habits: [habit] });
  });

  it('emite goalCompleted sólo al completar', () => {
    const listener = jest.fn();
    const off = appEventBus.on('productivity.goalCompleted', listener);

    useProductivityStore.getState().toggleGoal(goal.id);
    useProductivityStore.getState().toggleGoal(goal.id);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ goalId: goal.id });
    off();
  });

  it('emite habitCompleted sólo al completar', () => {
    const listener = jest.fn();
    const off = appEventBus.on('productivity.habitCompleted', listener);

    useProductivityStore.getState().toggleHabit(habit.id);
    useProductivityStore.getState().toggleHabit(habit.id);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ habitId: habit.id });
    off();
  });

  it('emite milestoneCompleted sólo al completar', () => {
    const listener = jest.fn();
    const off = appEventBus.on('productivity.milestoneCompleted', listener);

    useProductivityStore.getState().toggleMilestone(goal.id, 'milestone-1');
    useProductivityStore.getState().toggleMilestone(goal.id, 'milestone-1');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({
      goalId: goal.id,
      milestoneId: 'milestone-1',
    });
    off();
  });
});
