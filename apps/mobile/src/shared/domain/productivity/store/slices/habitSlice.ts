import type { StateCreator } from 'zustand';
import { isPlannedTime } from '@sui/contracts';
import type { Habit } from '@/shared/types/models';
import { advanceStreak, localDateKey } from '../../model/homeStorage';
import { appEventBus } from '@/shared/events/appEventBus';
import type { ProductivityState } from '../productivityState';

export type HabitActions = Pick<
  ProductivityState,
  'addHabit' | 'updateHabit' | 'toggleHabit' | 'freezeStreak' | 'removeHabit' | 'bumpStreak'
>;

/**
 * Acciones de hábitos.
 *
 * `toggleHabit` carga la mecánica Antigravity: completar un hábito vinculado a
 * una meta le suma 2% de avance, para que el hábito jale la meta en vez de
 * vivir por su cuenta.
 */
export const createHabitSlice: StateCreator<ProductivityState, [], [], HabitActions> = (
  set,
  get,
) => ({
  addHabit: ({
    title,
    frequency = 'daily',
    linkedGoalId = null,
    plannedTime,
    mirrorToGoogle = false,
  }) => {
    const trimmed = title.trim();
    if (!trimmed) return null;
    const validTime = isPlannedTime(plannedTime) ? plannedTime : undefined;

    const newHabit: Habit = {
      id: `habit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: trimmed,
      completed: false,
      frequency,
      streak: 0,
      linkedGoalId,
      createdAt: localDateKey(),
      ...(validTime ? { plannedTime: validTime } : {}),
      mirrorToGoogle,
    };

    set((s) => ({ habits: [newHabit, ...s.habits] }));
    return newHabit.id;
  },

  updateHabit: (id, { title, frequency, linkedGoalId, plannedTime, mirrorToGoogle }) => {
    const trimmed = title.trim();
    const current = get().habits.find((habit) => habit.id === id);
    if (!trimmed || !current || (frequency !== 'daily' && frequency.length === 0)) return false;
    const validTime =
      plannedTime === undefined
        ? current.plannedTime
        : isPlannedTime(plannedTime)
          ? plannedTime
          : undefined;
    set((state) => ({
      habits: state.habits.map((habit) =>
        habit.id === id
          ? {
              ...habit,
              title: trimmed,
              frequency,
              linkedGoalId,
              plannedTime: validTime,
              mirrorToGoogle: mirrorToGoogle ?? habit.mirrorToGoogle ?? false,
            }
          : habit,
      ),
    }));
    return true;
  },

  toggleHabit: (id) => {
    const state = get();
    const targetHabit = state.habits.find((h) => h.id === id);
    if (!targetHabit) return;

    const willComplete = !targetHabit.completed;
    const today = localDateKey();

    set((s) => {
      const nextHabits = s.habits.map((h) => {
        if (h.id !== id) return h;
        const nextStreak = willComplete ? h.streak + 1 : Math.max(0, h.streak - 1);
        return {
          ...h,
          completed: willComplete,
          streak: nextStreak,
          lastCompletedDate: willComplete ? today : h.lastCompletedDate,
        };
      });

      // Mecánica Antigravity: Si el hábito está vinculado a una Meta y se completa, incrementamos 2% a la meta
      let nextGoals = s.goals;
      if (willComplete && targetHabit.linkedGoalId) {
        nextGoals = s.goals.map((g) => {
          if (g.id !== targetHabit.linkedGoalId) return g;
          const nextProgress = Math.min(100, g.progress + 2);
          return {
            ...g,
            progress: nextProgress,
            completed: nextProgress === 100,
          };
        });
      }

      return { habits: nextHabits, goals: nextGoals };
    });
    if (willComplete) {
      appEventBus.emit('productivity.habitCompleted', {
        habitId: id,
        occurredAt: new Date().toISOString(),
      });
    }
  },

  freezeStreak: (habitId) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = localDateKey(tomorrow);

    set((s) => ({
      habits: s.habits.map((h) => (h.id === habitId ? { ...h, frozenUntil: tomorrowKey } : h)),
    }));
  },

  removeHabit: (id) => set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),

  bumpStreak: () => {
    const { streak, lastCompletedDate } = get();
    const next = advanceStreak({ streakCount: streak, lastCompletedDate });
    if (next.lastCompletedDate !== lastCompletedDate) {
      set({ streak: next.streakCount, lastCompletedDate: next.lastCompletedDate });
    }
  },
});
