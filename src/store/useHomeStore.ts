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
import {
  type DailySnapshot,
  computeTotalXp,
  makeSnapshot,
  upsertSnapshot,
} from '../services/gamification';
import { usePomodoroStore } from './usePomodoroStore';
import type { HomeListItem } from '../components/home/HomeListSection';

const CLOUD_LOAD_TIMEOUT_MS = 5000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);

export type HomeState = {
  goals: HomeListItem[];
  habits: HomeListItem[];
  streak: number;
  lastCompletedDate: string | undefined;
  lastResetDate: string | undefined;
  weeklyHistory: DailySnapshot[];
  totalXp: number;
  stateLoaded: boolean;

  setGoals: (goals: HomeListItem[]) => void;
  addGoal: (title: string) => boolean;
  toggleGoal: (id: string) => void;
  removeGoal: (id: string) => void;

  setHabits: (habits: HomeListItem[]) => void;
  addHabit: (title: string) => boolean;
  toggleHabit: (id: string) => void;
  removeHabit: (id: string) => void;

  bumpStreak: () => void;
  loadState: () => Promise<void>;
  saveState: () => Promise<void>;
};

const createItem = (title: string): HomeListItem => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title,
  completed: false,
});

const snapshotFromState = (
  goals: HomeListItem[],
  habits: HomeListItem[],
  date?: string,
): DailySnapshot => {
  const { pomodoroMinutes, pomodoroSessions } = usePomodoroStore.getState();
  return makeSnapshot(goals, habits, pomodoroSessions, pomodoroMinutes, date);
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

  bumpStreak: () => {
    const { streak, lastCompletedDate } = get();
    const next = advanceStreak({ streakCount: streak, lastCompletedDate });
    if (next.lastCompletedDate !== lastCompletedDate) {
      set({ streak: next.streakCount, lastCompletedDate: next.lastCompletedDate });
    }
  },

  loadState: async () => {
    if (get().stateLoaded) return;

    try {
      const user = auth.currentUser;

      const saved = await AsyncStorage.getItem(HOME_STATE_KEY);
      let localGoals: HomeListItem[] = [];
      let localHabits: HomeListItem[] = [];
      let localMinutes = 25;
      let localSessions = 0;
      let lastReset: string | undefined;
      let streakCount = 0;
      let lastCompleted: string | undefined;
      let weeklyHistory: DailySnapshot[] = [];

      if (saved) {
        const parsed = JSON.parse(saved);
        localGoals = parsed.goals ?? [];
        localHabits = parsed.habits ?? [];
        localMinutes = parsed.pomodoroMinutes ?? 25;
        localSessions = parsed.pomodoroSessions ?? 0;
        lastReset = parsed.lastResetDate;
        streakCount = parsed.streakCount ?? 0;
        lastCompleted = parsed.lastCompletedDate;
        weeklyHistory = parsed.weeklyHistory ?? [];
      }

      if (user?.uid) {
        const cloud = await withTimeout(loadUserData(user.uid), CLOUD_LOAD_TIMEOUT_MS);
        if (cloud) {
          localGoals = cloud.goals ?? [];
          localHabits = cloud.habits ?? [];
          localMinutes = cloud.pomodoroMinutes ?? localMinutes;
          localSessions = cloud.pomodoroSessions ?? localSessions;
          lastReset = cloud.lastResetDate ?? lastReset;
          streakCount = cloud.streakCount ?? streakCount;
          lastCompleted = cloud.lastCompletedDate ?? lastCompleted;
          weeklyHistory = cloud.weeklyHistory ?? weeklyHistory;
        }
      }

      const todayKey = localDateKey();

      if (lastReset && lastReset !== todayKey) {
        const prevSnapshot = makeSnapshot(
          localGoals,
          localHabits,
          localSessions,
          localMinutes,
          lastReset,
        );
        weeklyHistory = upsertSnapshot(weeklyHistory, prevSnapshot);
      }

      const reset = applyDailyReset(localGoals, localHabits, lastReset);
      const liveStreak = normalizeStreak({
        streakCount,
        lastCompletedDate: lastCompleted,
      });

      usePomodoroStore.getState().initFromStorage(localMinutes, localSessions);

      const todaySnapshot = makeSnapshot(
        reset.goals,
        reset.habits,
        localSessions,
        localMinutes,
        todayKey,
      );
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
        pomodoroMinutes: localMinutes,
        pomodoroSessions: localSessions,
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
      const { pomodoroMinutes, pomodoroSessions } = usePomodoroStore.getState();
      const user = auth.currentUser;

      const todaySnapshot = snapshotFromState(goals, habits);
      const updatedHistory = upsertSnapshot(weeklyHistory, todaySnapshot);
      const totalXp = computeTotalXp(updatedHistory);

      if (updatedHistory !== weeklyHistory || totalXp !== get().totalXp) {
        set({ weeklyHistory: updatedHistory, totalXp });
      }

      const stateObj = {
        goals,
        habits,
        pomodoroMinutes,
        pomodoroSessions,
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
