import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';
import { saveUserData, loadUserData } from '../services/db';
import {
  HOME_STATE_KEY,
  applyDailyReset,
  localDateKey,
  advanceStreak,
  normalizeStreak,
} from '../services/homeStorage';
import { useOnboardingStore } from './useOnboardingStore';
import { usePomodoroStore } from './usePomodoroStore';
import type { HomeListItem } from '../components/home/HomeListSection';

export type HomeState = {
  goals: HomeListItem[];
  habits: HomeListItem[];
  streak: number;
  lastCompletedDate: string | undefined;
  lastResetDate: string | undefined;
  stateLoaded: boolean;

  // Goals actions
  setGoals: (goals: HomeListItem[]) => void;
  addGoal: (title: string) => boolean;
  toggleGoal: (id: string) => void;
  removeGoal: (id: string) => void;

  // Habits actions
  setHabits: (habits: HomeListItem[]) => void;
  addHabit: (title: string) => boolean;
  toggleHabit: (id: string) => void;
  removeHabit: (id: string) => void;

  // Streak
  bumpStreak: () => void;

  // Persistence
  loadState: () => Promise<void>;
  saveState: () => Promise<void>;
};

const createItem = (title: string): HomeListItem => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title,
  completed: false,
});

export const useHomeStore = create<HomeState>((set, get) => ({
  goals: [],
  habits: [],
  streak: 0,
  lastCompletedDate: undefined,
  lastResetDate: undefined,
  stateLoaded: false,

  // Goals
  setGoals: (goals) => set({ goals }),

  addGoal: (title) => {
    const trimmed = title.trim();
    if (!trimmed) return false;
    set((s) => ({ goals: [createItem(trimmed), ...s.goals] }));
    return true;
  },

  toggleGoal: (id) =>
    set((s) => ({
      goals: s.goals.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g)),
    })),

  removeGoal: (id) =>
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

  // Habits
  setHabits: (habits) => set({ habits }),

  addHabit: (title) => {
    const trimmed = title.trim();
    if (!trimmed) return false;
    set((s) => ({ habits: [createItem(trimmed), ...s.habits] }));
    return true;
  },

  toggleHabit: (id) =>
    set((s) => ({
      habits: s.habits.map((h) => (h.id === id ? { ...h, completed: !h.completed } : h)),
    })),

  removeHabit: (id) =>
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),

  // Streak
  bumpStreak: () => {
    const { streak, lastCompletedDate } = get();
    const next = advanceStreak({ streakCount: streak, lastCompletedDate });
    if (next.lastCompletedDate !== lastCompletedDate) {
      set({ streak: next.streakCount, lastCompletedDate: next.lastCompletedDate });
    }
  },

  // Persistence
  loadState: async () => {
    try {
      const user = auth.currentUser;

      // Step 1: load local
      const saved = await AsyncStorage.getItem(HOME_STATE_KEY);
      let localGoals: HomeListItem[] = [];
      let localHabits: HomeListItem[] = [];
      let localMinutes = 25;
      let localSessions = 0;
      let lastReset: string | undefined;
      let streakCount = 0;
      let lastCompleted: string | undefined;

      if (saved) {
        const parsed = JSON.parse(saved);
        localGoals = parsed.goals ?? [];
        localHabits = parsed.habits ?? [];
        localMinutes = parsed.pomodoroMinutes ?? 25;
        localSessions = parsed.pomodoroSessions ?? 0;
        lastReset = parsed.lastResetDate;
        streakCount = parsed.streakCount ?? 0;
        lastCompleted = parsed.lastCompletedDate;
      }

      // Step 2: cloud overrides local
      if (user?.uid) {
        const cloud = await loadUserData(user.uid);
        if (cloud) {
          localGoals = cloud.goals ?? [];
          localHabits = cloud.habits ?? [];
          localMinutes = cloud.pomodoroMinutes ?? localMinutes;
          localSessions = cloud.pomodoroSessions ?? localSessions;
          lastReset = cloud.lastResetDate ?? lastReset;
          streakCount = cloud.streakCount ?? streakCount;
          lastCompleted = cloud.lastCompletedDate ?? lastCompleted;
        }
      }

      // Step 3: daily reset
      const reset = applyDailyReset(localGoals, localHabits, lastReset);

      // Streak normalization
      const liveStreak = normalizeStreak({
        streakCount,
        lastCompletedDate: lastCompleted,
      });

      set({
        goals: reset.goals,
        habits: reset.habits,
        streak: liveStreak,
        lastCompletedDate: lastCompleted,
        lastResetDate: reset.todayKey,
        stateLoaded: true,
      });

      // Init pomodoro store
      usePomodoroStore.getState().initFromStorage(localMinutes, localSessions);

      // Persist immediately
      const persisted = {
        goals: reset.goals,
        habits: reset.habits,
        pomodoroMinutes: localMinutes,
        pomodoroSessions: localSessions,
        lastResetDate: reset.todayKey,
        streakCount: liveStreak,
        lastCompletedDate: lastCompleted,
      };
      await AsyncStorage.setItem(HOME_STATE_KEY, JSON.stringify(persisted));
      if (user?.uid && reset.didReset) {
        await saveUserData(user.uid, persisted);
      }
    } catch (err) {
      console.error('Failed to load state:', err);
    }
  },

  saveState: async () => {
    const { goals, habits, streak, lastCompletedDate, lastResetDate } = get();
    const { pomodoroMinutes, pomodoroSessions } = usePomodoroStore.getState();
    const user = auth.currentUser;

    const stateObj = {
      goals,
      habits,
      pomodoroMinutes,
      pomodoroSessions,
      lastResetDate: lastResetDate ?? localDateKey(),
      streakCount: streak,
      lastCompletedDate: lastCompletedDate,
    };

    try {
      await AsyncStorage.setItem(HOME_STATE_KEY, JSON.stringify(stateObj));
      if (user?.uid) {
        await saveUserData(user.uid, stateObj);
      }
    } catch (err) {
      console.error('Failed to save state:', err);
    }
  },
}));
