jest.mock('@/shared/infrastructure/firebase/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('@/shared/observability/telemetry', () => ({ recordTelemetry: jest.fn() }));

import { useProductivityStore } from '../store/useProductivityStore';

const goal = {
  id: 'goal-1',
  title: 'Original',
  deadline: '2026-09-10',
  progress: 42,
  milestones: [{ id: 'm-1', title: 'Step', completed: true }],
  impactDays: ['2026-09-08', '2026-09-10', '2026-09-20'],
  completed: false,
  gravity: 'low' as const,
  createdAt: '2026-08-01',
};

const habit = {
  id: 'habit-1',
  title: 'Original habit',
  completed: true,
  frequency: 'daily' as const,
  streak: 12,
  lastCompletedDate: '2026-09-01',
  frozenUntil: '2026-09-02',
  linkedGoalId: goal.id,
  createdAt: '2026-08-02',
};

describe('productivity editing', () => {
  beforeEach(() => {
    useProductivityStore.setState({ goals: [goal], habits: [habit] });
  });

  it('edita meta preservando identidad y progreso, reemplaza deadline en impactDays', () => {
    expect(
      useProductivityStore.getState().updateGoal(goal.id, {
        title: 'Updated',
        deadline: '2026-09-15',
        gravity: 'high',
      }),
    ).toBe(true);

    expect(useProductivityStore.getState().goals[0]).toEqual({
      ...goal,
      title: 'Updated',
      deadline: '2026-09-15',
      gravity: 'high',
      impactDays: ['2026-09-08', '2026-09-15', '2026-09-20'],
    });
  });

  it('edita hábito preservando racha, estado y fechas', () => {
    expect(
      useProductivityStore.getState().updateHabit(habit.id, {
        title: 'Updated habit',
        frequency: ['mon', 'wed'],
        linkedGoalId: null,
      }),
    ).toBe(true);

    expect(useProductivityStore.getState().habits[0]).toEqual({
      ...habit,
      title: 'Updated habit',
      frequency: ['mon', 'wed'],
      linkedGoalId: null,
    });
  });

  it('eliminar meta desvincula hábitos', () => {
    useProductivityStore.getState().removeGoal(goal.id);
    expect(useProductivityStore.getState().goals).toEqual([]);
    expect(useProductivityStore.getState().habits[0].linkedGoalId).toBeNull();
  });
});
