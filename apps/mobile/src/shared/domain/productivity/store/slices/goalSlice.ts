import type { StateCreator } from 'zustand';
import type { Goal, Milestone } from '@/shared/types/models';
import { localDateKey } from '../../model/homeStorage';
import { appEventBus } from '@/shared/events/appEventBus';
import type { ProductivityState } from '../productivityState';

export type GoalActions = Pick<
  ProductivityState,
  'addGoal' | 'updateGoal' | 'toggleGoal' | 'addMilestone' | 'toggleMilestone' | 'removeGoal'
>;

/**
 * Acciones de metas. Al completar una meta o un hito se emite un evento de
 * dominio en vez de llamar a la UI: el bus desacopla la celebración y la
 * telemetría del store (§12).
 */
export const createGoalSlice: StateCreator<ProductivityState, [], [], GoalActions> = (
  set,
  get,
) => ({
  addGoal: ({
    title,
    deadline,
    gravity = 'low',
    milestones = [],
    mirrorToGoogle = true,
    impactDays,
  }) => {
    const trimmed = title.trim();
    if (!trimmed) return null;

    const newGoal: Goal = {
      id: `goal-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: trimmed,
      deadline,
      progress: 0,
      milestones: milestones.map((m, idx) => ({
        id: `m-${Date.now()}-${idx}`,
        title: m,
        completed: false,
      })),
      impactDays: impactDays ?? [deadline],
      completed: false,
      gravity,
      createdAt: localDateKey(),
      mirrorToGoogle,
    };

    set((s) => ({ goals: [newGoal, ...s.goals] }));
    return newGoal.id;
  },

  updateGoal: (id, { title, deadline, gravity, mirrorToGoogle }) => {
    const trimmed = title.trim();
    const current = get().goals.find((goal) => goal.id === id);
    if (!trimmed || !current) return false;
    const impactDays = Array.from(
      new Set(
        (current.impactDays ?? [current.deadline]).map((day) =>
          day === current.deadline ? deadline : day,
        ),
      ),
    );
    if (!impactDays.includes(deadline)) impactDays.push(deadline);
    set((state) => ({
      goals: state.goals.map((goal) =>
        goal.id === id
          ? {
              ...goal,
              title: trimmed,
              deadline,
              gravity,
              impactDays,
              mirrorToGoogle: mirrorToGoogle ?? goal.mirrorToGoogle ?? true,
            }
          : goal,
      ),
    }));
    return true;
  },

  toggleGoal: (id) => {
    const goal = get().goals.find((item) => item.id === id);
    if (!goal) return;
    const completed = !goal.completed;
    set((s) => ({
      goals: s.goals.map((g) => {
        if (g.id !== id) return g;
        return {
          ...g,
          completed,
          progress: completed ? 100 : g.progress,
        };
      }),
    }));
    if (completed) {
      appEventBus.emit('productivity.goalCompleted', {
        goalId: id,
        occurredAt: new Date().toISOString(),
      });
    }
  },

  addMilestone: (goalId, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    set((s) => ({
      goals: s.goals.map((g) => {
        if (g.id !== goalId) return g;
        const newMilestones: Milestone[] = [
          ...g.milestones,
          { id: `m-${Date.now()}`, title: trimmed, completed: false },
        ];
        const completedCount = newMilestones.filter((m) => m.completed).length;
        const progress = Math.round((completedCount / newMilestones.length) * 100);
        return { ...g, milestones: newMilestones, progress, completed: progress === 100 };
      }),
    }));
  },

  toggleMilestone: (goalId, milestoneId) => {
    const milestone = get()
      .goals.find((item) => item.id === goalId)
      ?.milestones.find((item) => item.id === milestoneId);
    if (!milestone) return;
    const completed = !milestone.completed;
    set((s) => ({
      goals: s.goals.map((g) => {
        if (g.id !== goalId) return g;
        const newMilestones = g.milestones.map((m) =>
          m.id === milestoneId ? { ...m, completed: !m.completed } : m,
        );
        const completedCount = newMilestones.filter((m) => m.completed).length;
        const progress =
          newMilestones.length === 0
            ? 0
            : Math.round((completedCount / newMilestones.length) * 100);
        return { ...g, milestones: newMilestones, progress, completed: progress === 100 };
      }),
    }));
    if (completed) {
      appEventBus.emit('productivity.milestoneCompleted', {
        goalId,
        milestoneId,
        occurredAt: new Date().toISOString(),
      });
    }
  },

  removeGoal: (id) =>
    set((state) => ({
      goals: state.goals.filter((goal) => goal.id !== id),
      habits: state.habits.map((habit) =>
        habit.linkedGoalId === id ? { ...habit, linkedGoalId: null } : habit,
      ),
    })),
});
