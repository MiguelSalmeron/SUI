import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import { saveUserData, loadUserData } from './userData';
import {
  HOME_STATE_KEY,
  applyDailyReset,
  localDateKey,
  advanceStreak,
  normalizeStreak,
  yesterdayKey,
} from './homeStorage';
import {
  type DailySnapshot,
  computeTotalXp,
  makeSnapshot,
  upsertSnapshot,
} from './gamification';
import type { Goal, Habit, GoalGravity, DayOfWeek, Milestone } from '@/shared/types/models';

const CLOUD_LOAD_TIMEOUT_MS = 5000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);

export type HomeState = {
  goals: Goal[];
  habits: Habit[];
  streak: number;
  lastCompletedDate: string | undefined;
  lastResetDate: string | undefined;
  weeklyHistory: DailySnapshot[];
  totalXp: number;
  stateLoaded: boolean;

  setGoals: (goals: Goal[]) => void;
  addGoal: (payload: { title: string; deadline: string; gravity?: GoalGravity; milestones?: string[] }) => boolean;
  updateGoal: (id: string, payload: Partial<Goal>) => void;
  toggleGoal: (id: string) => void;
  addMilestone: (goalId: string, title: string) => void;
  toggleMilestone: (goalId: string, milestoneId: string) => void;
  removeGoal: (id: string) => void;

  setHabits: (habits: Habit[]) => void;
  addHabit: (payload: { title: string; frequency?: 'daily' | DayOfWeek[]; linkedGoalId?: string | null }) => boolean;
  updateHabit: (id: string, payload: Partial<Habit>) => void;
  toggleHabit: (id: string) => void;
  freezeStreak: (habitId: string) => void;
  removeHabit: (id: string) => void;

  bumpStreak: () => void;
  addXp: (amount: number) => void;
  loadState: () => Promise<void>;
  saveState: () => Promise<void>;
};

let saveInFlight = false;
let saveQueued = false;

export const useHomeStore = create<HomeState>((set, get) => ({
  goals: [],
  habits: [],
  streak: 0,
  lastCompletedDate: undefined,
  lastResetDate: undefined,
  weeklyHistory: [],
  totalXp: 0,
  stateLoaded: false,

  setGoals: (goals) => set({ goals }),

  addGoal: ({ title, deadline, gravity = 'low', milestones = [] }) => {
    const trimmed = title.trim();
    if (!trimmed) return false;

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
      impactDays: [deadline],
      completed: false,
      gravity,
      createdAt: localDateKey(),
    };

    set((s) => ({ goals: [newGoal, ...s.goals] }));
    return true;
  },

  updateGoal: (id, payload) =>
    set((s) => ({
      goals: s.goals.map((g) => (g.id === id ? { ...g, ...payload } : g)),
    })),

  toggleGoal: (id) =>
    set((s) => ({
      goals: s.goals.map((g) => {
        if (g.id !== id) return g;
        const nextCompleted = !g.completed;
        return {
          ...g,
          completed: nextCompleted,
          progress: nextCompleted ? 100 : g.progress,
        };
      }),
    })),

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

  toggleMilestone: (goalId, milestoneId) =>
    set((s) => ({
      goals: s.goals.map((g) => {
        if (g.id !== goalId) return g;
        const newMilestones = g.milestones.map((m) =>
          m.id === milestoneId ? { ...m, completed: !m.completed } : m,
        );
        const completedCount = newMilestones.filter((m) => m.completed).length;
        const progress =
          newMilestones.length === 0 ? 0 : Math.round((completedCount / newMilestones.length) * 100);
        return { ...g, milestones: newMilestones, progress, completed: progress === 100 };
      }),
    })),

  removeGoal: (id) =>
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

  setHabits: (habits) => set({ habits }),

  addHabit: ({ title, frequency = 'daily', linkedGoalId = null }) => {
    const trimmed = title.trim();
    if (!trimmed) return false;

    const newHabit: Habit = {
      id: `habit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: trimmed,
      completed: false,
      frequency,
      streak: 0,
      linkedGoalId,
      createdAt: localDateKey(),
    };

    set((s) => ({ habits: [newHabit, ...s.habits] }));
    return true;
  },

  updateHabit: (id, payload) =>
    set((s) => ({
      habits: s.habits.map((h) => (h.id === id ? { ...h, ...payload } : h)),
    })),

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
  },

  freezeStreak: (habitId) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = localDateKey(tomorrow);

    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === habitId ? { ...h, frozenUntil: tomorrowKey } : h,
      ),
    }));
  },

  removeHabit: (id) =>
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),

  bumpStreak: () => {
    const { streak, lastCompletedDate } = get();
    const next = advanceStreak({ streakCount: streak, lastCompletedDate });
    if (next.lastCompletedDate !== lastCompletedDate) {
      set({ streak: next.streakCount, lastCompletedDate: next.lastCompletedDate });
    }
  },

  addXp: (amount) => set((s) => ({ totalXp: s.totalXp + amount })),

  loadState: async () => {
    if (get().stateLoaded) return;

    try {
      const user = auth.currentUser;
      const saved = await AsyncStorage.getItem(HOME_STATE_KEY);
      let localGoals: Goal[] = [];
      let localHabits: Habit[] = [];
      let lastReset: string | undefined;
      let streakCount = 0;
      let lastCompleted: string | undefined;
      let weeklyHistory: DailySnapshot[] = [];

      if (saved) {
        const parsed = JSON.parse(saved);
        localGoals = parsed.goals ?? [];
        localHabits = parsed.habits ?? [];
        lastReset = parsed.lastResetDate;
        streakCount = parsed.streakCount ?? 0;
        lastCompleted = parsed.lastCompletedDate;
        weeklyHistory = parsed.weeklyHistory ?? [];
      }

      if (user?.uid) {
        const cloud = await withTimeout(loadUserData(user.uid), CLOUD_LOAD_TIMEOUT_MS);
        if (cloud) {
          localGoals = cloud.goals ?? localGoals;
          localHabits = cloud.habits ?? localHabits;
          lastReset = cloud.lastResetDate ?? lastReset;
          streakCount = cloud.streakCount ?? streakCount;
          lastCompleted = cloud.lastCompletedDate ?? lastCompleted;
          weeklyHistory = cloud.weeklyHistory ?? weeklyHistory;
        }
      }

      const todayKey = localDateKey();

      if (lastReset && lastReset !== todayKey) {
        const prevSnapshot = makeSnapshot(localGoals, localHabits, lastReset);
        weeklyHistory = upsertSnapshot(weeklyHistory, prevSnapshot);
      }

      const reset = applyDailyReset(localGoals, localHabits, lastReset);
      const liveStreak = normalizeStreak({
        streakCount,
        lastCompletedDate: lastCompleted,
      });

      const todaySnapshot = makeSnapshot(reset.goals, reset.habits, todayKey);
      weeklyHistory = upsertSnapshot(weeklyHistory, todaySnapshot);
      const totalXp = computeTotalXp(weeklyHistory);

      set({
        goals: reset.goals,
        habits: reset.habits,
        streak: liveStreak,
        lastCompletedDate: lastCompleted,
        lastResetDate: reset.todayKey,
        weeklyHistory,
        totalXp,
        stateLoaded: true,
      });

      const persisted = {
        goals: reset.goals,
        habits: reset.habits,
        lastResetDate: reset.todayKey,
        streakCount: liveStreak,
        lastCompletedDate: lastCompleted,
        weeklyHistory,
        totalXp,
      };
      await AsyncStorage.setItem(HOME_STATE_KEY, JSON.stringify(persisted));
      if (user?.uid && reset.didReset) {
        await saveUserData(user.uid, persisted).catch(() => undefined);
      }
    } catch (err) {
      console.error('Failed to load state:', err);
      set({ stateLoaded: true });
    }
  },

  saveState: async () => {
    if (saveInFlight) {
      saveQueued = true;
      return;
    }
    saveInFlight = true;

    try {
      const { goals, habits, streak, lastCompletedDate, lastResetDate, weeklyHistory } = get();
      const user = auth.currentUser;

      const todaySnapshot = makeSnapshot(goals, habits);
      const updatedHistory = upsertSnapshot(weeklyHistory, todaySnapshot);
      const totalXp = computeTotalXp(updatedHistory);

      if (updatedHistory !== weeklyHistory || totalXp !== get().totalXp) {
        set({ weeklyHistory: updatedHistory, totalXp });
      }

      const stateObj = {
        goals,
        habits,
        lastResetDate: lastResetDate ?? localDateKey(),
        streakCount: streak,
        lastCompletedDate: lastCompletedDate,
        weeklyHistory: updatedHistory,
        totalXp,
      };

      await AsyncStorage.setItem(HOME_STATE_KEY, JSON.stringify(stateObj));
      if (user?.uid) {
        await saveUserData(user.uid, stateObj).catch(() => undefined);
      }
    } catch (err) {
      console.error('Failed to save state:', err);
    } finally {
      saveInFlight = false;
      if (saveQueued) {
        saveQueued = false;
        void get().saveState();
      }
    }
  },
}));
