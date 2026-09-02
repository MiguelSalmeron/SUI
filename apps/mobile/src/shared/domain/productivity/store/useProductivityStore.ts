import { create } from 'zustand';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import {
  applyDailyReset,
  localDateKey,
  advanceStreak,
  normalizeStreak,
} from '../model/homeStorage';
import {
  type DailySnapshot,
  computeTotalXp,
  makeSnapshot,
  upsertSnapshot,
} from '../model/gamification';
import type { Goal, Habit, GoalGravity, DayOfWeek, Milestone } from '@/shared/types/models';
import { useIntroStore } from '@/shared/account/useIntroStore';
import {
  clearLocalProductivity,
  combineProductivity,
  loadLocalProductivity,
  persistLocalProductivity,
  replaceLocalProductivity,
} from '../persistence/productivityRepository';
import { pullCloudProductivity, synchronizeProductivity } from '../sync/syncCoordinator';
import type { ProductivityData, SyncStatus } from '../sync/syncTypes';
import { recordTelemetry } from '@/shared/observability/telemetry';
import { appEventBus } from '@/shared/events/appEventBus';

export type ProductivityState = {
  goals: Goal[];
  habits: Habit[];
  streak: number;
  lastCompletedDate: string | undefined;
  lastResetDate: string | undefined;
  weeklyHistory: DailySnapshot[];
  totalXp: number;
  stateLoaded: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;

  addGoal: (payload: {
    title: string;
    deadline: string;
    gravity?: GoalGravity;
    milestones?: string[];
  }) => boolean;
  updateGoal: (
    id: string,
    payload: { title: string; deadline: string; gravity: GoalGravity },
  ) => boolean;
  toggleGoal: (id: string) => void;
  addMilestone: (goalId: string, title: string) => void;
  toggleMilestone: (goalId: string, milestoneId: string) => void;
  removeGoal: (id: string) => void;

  addHabit: (payload: {
    title: string;
    frequency?: 'daily' | DayOfWeek[];
    linkedGoalId?: string | null;
  }) => boolean;
  updateHabit: (
    id: string,
    payload: { title: string; frequency: 'daily' | DayOfWeek[]; linkedGoalId: string | null },
  ) => boolean;
  toggleHabit: (id: string) => void;
  freezeStreak: (habitId: string) => void;
  removeHabit: (id: string) => void;

  bumpStreak: () => void;
  loadState: () => Promise<void>;
  reloadState: () => Promise<void>;
  saveState: () => Promise<void>;
  syncNow: () => Promise<void>;
  resolveCloudMerge: (strategy: 'combine' | 'cloud') => Promise<void>;
  clearState: () => Promise<void>;
};

let saveInFlight = false;
let saveQueued = false;
let syncInFlight = false;
let syncQueued = false;

const toProductivityData = (state: ProductivityState): ProductivityData => ({
  goals: state.goals,
  habits: state.habits,
  lastResetDate: state.lastResetDate,
  streakCount: state.streak,
  lastCompletedDate: state.lastCompletedDate,
  weeklyHistory: state.weeklyHistory,
  totalXp: state.totalXp,
});

const normalizeLoadedData = (data: ProductivityData): ProductivityData => {
  let weeklyHistory = [...data.weeklyHistory];
  const todayKey = localDateKey();
  if (data.lastResetDate && data.lastResetDate !== todayKey) {
    weeklyHistory = upsertSnapshot(
      weeklyHistory,
      makeSnapshot(data.goals, data.habits, data.lastResetDate),
    );
  }
  const reset = applyDailyReset(data.goals, data.habits, data.lastResetDate);
  weeklyHistory = upsertSnapshot(weeklyHistory, makeSnapshot(reset.goals, reset.habits, todayKey));
  return {
    ...data,
    goals: reset.goals,
    habits: reset.habits,
    lastResetDate: reset.todayKey,
    streakCount: normalizeStreak({
      streakCount: data.streakCount,
      lastCompletedDate: data.lastCompletedDate,
    }),
    weeklyHistory,
    totalXp: computeTotalXp(weeklyHistory),
  };
};

const statePatch = (data: ProductivityData) => ({
  goals: data.goals,
  habits: data.habits,
  streak: data.streakCount,
  lastCompletedDate: data.lastCompletedDate,
  lastResetDate: data.lastResetDate,
  weeklyHistory: data.weeklyHistory,
  totalXp: data.totalXp,
});

export const useProductivityStore = create<ProductivityState>((set, get) => ({
  goals: [],
  habits: [],
  streak: 0,
  lastCompletedDate: undefined,
  lastResetDate: undefined,
  weeklyHistory: [],
  totalXp: 0,
  stateLoaded: false,
  syncStatus: 'local',
  lastSyncedAt: null,

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

  updateGoal: (id, { title, deadline, gravity }) => {
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
        goal.id === id ? { ...goal, title: trimmed, deadline, gravity, impactDays } : goal,
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

  updateHabit: (id, { title, frequency, linkedGoalId }) => {
    const trimmed = title.trim();
    const current = get().habits.find((habit) => habit.id === id);
    if (!trimmed || !current || (frequency !== 'daily' && frequency.length === 0)) return false;
    set((state) => ({
      habits: state.habits.map((habit) =>
        habit.id === id ? { ...habit, title: trimmed, frequency, linkedGoalId } : habit,
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

  loadState: async () => {
    if (get().stateLoaded) return;
    try {
      const envelope = await loadLocalProductivity();
      const normalized = normalizeLoadedData(envelope.data);
      set({
        ...statePatch(normalized),
        stateLoaded: true,
        syncStatus: envelope.outbox.length ? 'pending' : 'local',
        lastSyncedAt: envelope.lastSyncedAt,
      });
      void get().syncNow();
    } catch {
      set({ stateLoaded: true, syncStatus: 'error' });
    }
  },

  reloadState: async () => {
    set({ stateLoaded: false });
    await get().loadState();
  },

  saveState: async () => {
    if (saveInFlight) {
      saveQueued = true;
      return;
    }
    saveInFlight = true;

    try {
      const { goals, habits, streak, lastCompletedDate, lastResetDate, weeklyHistory } = get();

      const todaySnapshot = makeSnapshot(goals, habits);
      const updatedHistory = upsertSnapshot(weeklyHistory, todaySnapshot);
      const totalXp = computeTotalXp(updatedHistory);

      if (updatedHistory !== weeklyHistory || totalXp !== get().totalXp) {
        set({ weeklyHistory: updatedHistory, totalXp });
      }

      const data: ProductivityData = {
        goals,
        habits,
        lastResetDate: lastResetDate ?? localDateKey(),
        streakCount: streak,
        lastCompletedDate: lastCompletedDate,
        weeklyHistory: updatedHistory,
        totalXp,
      };
      const envelope = await persistLocalProductivity(data);
      const syncEnabled = useIntroStore.getState().syncEnabled;
      set({
        syncStatus: syncEnabled && envelope.outbox.length ? 'pending' : 'local',
      });
      if (syncEnabled) void get().syncNow();
    } catch {
      set({ syncStatus: 'error' });
    } finally {
      saveInFlight = false;
      if (saveQueued) {
        saveQueued = false;
        void get().saveState();
      }
    }
  },

  syncNow: async () => {
    const syncStartedAt = Date.now();
    const user = auth.currentUser;
    const intro = useIntroStore.getState();
    const passwordProvider = user?.providerData.some((item) => item.providerId === 'password');
    const canSync = Boolean(
      intro.syncEnabled && user && !user.isAnonymous && (!passwordProvider || user.emailVerified),
    );
    if (!canSync || !user) {
      set({ syncStatus: 'local' });
      return;
    }
    if (syncInFlight) {
      syncQueued = true;
      return;
    }
    syncInFlight = true;
    set({ syncStatus: 'syncing' });
    try {
      const result = await synchronizeProductivity(user.uid, toProductivityData(get()));
      const normalized = normalizeLoadedData(result.data);
      const currentData = toProductivityData(get());
      const stateChanged =
        JSON.stringify(normalized.goals) !== JSON.stringify(currentData.goals) ||
        JSON.stringify(normalized.habits) !== JSON.stringify(currentData.habits) ||
        JSON.stringify(normalized.weeklyHistory) !== JSON.stringify(currentData.weeklyHistory) ||
        normalized.lastResetDate !== currentData.lastResetDate ||
        normalized.streakCount !== currentData.streakCount ||
        normalized.lastCompletedDate !== currentData.lastCompletedDate ||
        normalized.totalXp !== currentData.totalXp;
      set(
        stateChanged
          ? {
              ...statePatch(normalized),
              syncStatus: result.pending ? 'pending' : 'synced',
              lastSyncedAt: result.lastSyncedAt,
            }
          : {
              syncStatus: result.pending ? 'pending' : 'synced',
              lastSyncedAt: result.lastSyncedAt,
            },
      );
      recordTelemetry(
        'sync.completed',
        {
          result: 'success',
          direction: 'push-pull',
          accepted: result.accepted,
          replayed: result.replayed,
          conflicts: result.rejected,
          collisions: result.collisions,
          pending: result.pending,
          migratedLegacy: result.migratedLegacy,
          pages: result.pages,
          compacted: result.compacted,
          epochResets: result.epochResets,
        },
        Date.now() - syncStartedAt,
      );
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      set({
        syncStatus: code.includes('unavailable') || code.includes('network') ? 'offline' : 'error',
      });
      recordTelemetry('sync.completed', { result: 'error' }, Date.now() - syncStartedAt);
    } finally {
      syncInFlight = false;
      if (syncQueued) {
        syncQueued = false;
        void get().syncNow();
      }
    }
  },

  resolveCloudMerge: async (strategy) => {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;
    set({ syncStatus: 'syncing' });
    try {
      const local = await loadLocalProductivity();
      const cloud = await pullCloudProductivity(user.uid);
      const emptyCloud: ProductivityData = {
        goals: [],
        habits: [],
        weeklyHistory: [],
        streakCount: 0,
        totalXp: 0,
      };
      const selected =
        strategy === 'cloud'
          ? (cloud?.data ?? emptyCloud)
          : combineProductivity(local.data, cloud?.data ?? emptyCloud);
      const normalized = normalizeLoadedData(selected);
      let lastSyncedAt = new Date().toISOString();
      if (strategy === 'cloud') {
        await replaceLocalProductivity(
          normalized,
          cloud?.metadata ?? {},
          cloud?.summaryMeta ?? null,
          cloud?.pullState,
        );
      } else {
        await replaceLocalProductivity(
          normalized,
          cloud?.metadata ?? {},
          cloud?.summaryMeta ?? null,
          cloud?.pullState,
        );
        const result = await synchronizeProductivity(user.uid, normalized);
        lastSyncedAt = result.lastSyncedAt;
      }
      useIntroStore.getState().registerAccount(true);
      set({
        ...statePatch(normalized),
        stateLoaded: true,
        syncStatus: 'synced',
        lastSyncedAt,
      });
    } catch {
      set({ syncStatus: 'error' });
      throw new Error('merge-failed');
    }
  },

  clearState: async () => {
    await clearLocalProductivity();
    set({
      goals: [],
      habits: [],
      streak: 0,
      lastCompletedDate: undefined,
      lastResetDate: undefined,
      weeklyHistory: [],
      totalXp: 0,
      stateLoaded: true,
      syncStatus: 'local',
      lastSyncedAt: null,
    });
  },
}));
