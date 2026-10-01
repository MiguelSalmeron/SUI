import type { StateCreator } from 'zustand';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import { useIntroStore } from '@/shared/account/useIntroStore';
import { applyUserPreferences, getCurrentPreferences } from '@/shared/preferences/useSettingsStore';
import { recordTelemetry } from '@/shared/observability/telemetry';
import { localDateKey } from '../../model/homeStorage';
import { makeSnapshot, snapshotXp, upsertSnapshot } from '../../model/gamification';
import {
  clearLocalProductivity,
  combineProductivity,
  loadLocalProductivity,
  persistLocalProductivity,
  replaceLocalProductivity,
} from '../../persistence/productivityRepository';
import { pullCloudProductivity, synchronizeProductivity } from '../../sync/syncCoordinator';
import type { ProductivityData } from '../../sync/syncTypes';
import { normalizeLoadedData, statePatch, toProductivityData } from '../productivityMappers';
import { productivityRuntime } from '../productivityRuntime';
import type { ProductivityState } from '../productivityState';

export type PersistenceActions = Pick<
  ProductivityState,
  'saveState' | 'syncNow' | 'resolveCloudMerge' | 'clearState'
>;

/**
 * Escritura local, sync con la nube y merge tras registro.
 *
 * Los guardados y los syncs se serializan con las banderas de
 * `productivityRuntime`: si algo llega mientras hay uno en vuelo, se encola en
 * vez de pisar la escritura en curso.
 */
export const createPersistenceSlice: StateCreator<
  ProductivityState,
  [],
  [],
  PersistenceActions
> = (set, get) => ({
  saveState: async () => {
    // Un guardado encolado tras clearState (logout/borrado) no debe escribir:
    // con la sesión ya cerrada persistiría en la clave base sin uid.
    if (!get().stateLoaded) return;
    if (productivityRuntime.saveInFlight) {
      productivityRuntime.saveQueued = true;
      return;
    }
    productivityRuntime.saveInFlight = true;

    try {
      const { goals, habits, streak, lastCompletedDate, lastResetDate, weeklyHistory } = get();

      const todaySnapshot = makeSnapshot(goals, habits);
      const existingToday = weeklyHistory.find((s) => s.date === todaySnapshot.date);
      const oldTodayXp = existingToday ? snapshotXp(existingToday) : 0;
      const newTodayXp = snapshotXp(todaySnapshot);
      const xpDelta = newTodayXp - oldTodayXp;
      const currentXp = typeof get().totalXp === 'number' ? get().totalXp : 0;
      const nextTotalXp = Math.max(0, currentXp + xpDelta);

      const updatedHistory = upsertSnapshot(weeklyHistory, todaySnapshot);

      if (updatedHistory !== weeklyHistory || nextTotalXp !== currentXp) {
        set({ weeklyHistory: updatedHistory, totalXp: nextTotalXp });
      }

      const preferences = getCurrentPreferences();
      const data: ProductivityData = {
        goals,
        habits,
        lastResetDate: lastResetDate ?? localDateKey(),
        streakCount: streak,
        lastCompletedDate,
        weeklyHistory: updatedHistory,
        totalXp: nextTotalXp,
        preferences,
      };
      const currentUid = auth.currentUser?.uid;
      const envelope = await persistLocalProductivity(data, currentUid);
      const syncEnabled = useIntroStore.getState().syncEnabled;
      set({
        syncStatus: syncEnabled && envelope.outbox.length ? 'pending' : 'local',
      });
      if (syncEnabled) void get().syncNow();
    } catch {
      set({ syncStatus: 'error' });
    } finally {
      productivityRuntime.saveInFlight = false;
      if (productivityRuntime.saveQueued) {
        productivityRuntime.saveQueued = false;
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
    if (productivityRuntime.syncInFlight) {
      productivityRuntime.syncQueued = true;
      return;
    }
    productivityRuntime.syncInFlight = true;
    set({ syncStatus: 'syncing' });
    try {
      const result = await synchronizeProductivity(user.uid, toProductivityData(get()));
      if (result.data.preferences) {
        applyUserPreferences(result.data.preferences);
      }
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
      const code = ((error as { code?: string })?.code ?? '').toLowerCase();
      const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
      const isOffline =
        code.includes('unavailable') ||
        code.includes('network') ||
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('offline') ||
        message.includes('aborted');
      set({
        syncStatus: isOffline ? 'offline' : 'error',
      });
      recordTelemetry('sync.completed', { result: 'error' }, Date.now() - syncStartedAt);
    } finally {
      productivityRuntime.syncInFlight = false;
      if (productivityRuntime.syncQueued) {
        productivityRuntime.syncQueued = false;
        void get().syncNow();
      }
    }
  },

  resolveCloudMerge: async (strategy) => {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;
    const previousAnonymousUid = useIntroStore.getState().previousAnonymousUid;
    set({ syncStatus: 'syncing' });
    try {
      const guestKey = previousAnonymousUid?.trim() ? previousAnonymousUid : undefined;
      const guestEnvelope = await loadLocalProductivity(guestKey);
      const localEnvelope = await loadLocalProductivity(user.uid);
      const localData = combineProductivity(guestEnvelope.data, localEnvelope.data);
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
          : combineProductivity(localData, cloud?.data ?? emptyCloud);
      const normalized = normalizeLoadedData(selected);
      if (normalized.preferences) {
        applyUserPreferences(normalized.preferences);
      }
      let lastSyncedAt = new Date().toISOString();
      if (strategy === 'cloud') {
        await replaceLocalProductivity(
          normalized,
          cloud?.metadata ?? {},
          cloud?.summaryMeta ?? null,
          cloud?.pullState,
          user.uid,
        );
      } else {
        await replaceLocalProductivity(
          normalized,
          cloud?.metadata ?? {},
          cloud?.summaryMeta ?? null,
          cloud?.pullState,
          user.uid,
        );
        const result = await synchronizeProductivity(user.uid, normalized);
        lastSyncedAt = result.lastSyncedAt;
      }
      if (previousAnonymousUid?.trim()) {
        await clearLocalProductivity(previousAnonymousUid);
        useIntroStore.getState().setPreviousAnonymousUid(null);
      }
      useIntroStore.getState().registerAccount(true);
      productivityRuntime.loadedForUid = user.uid;
      set({
        ...statePatch(normalized),
        localLoaded: true,
        stateLoaded: true,
        syncStatus: 'synced',
        lastSyncedAt,
      });
    } catch {
      set({ syncStatus: 'error' });
      throw new Error('merge-failed');
    }
  },

  clearState: async (options?: { preserveStorage?: boolean }) => {
    if (!options?.preserveStorage) {
      const currentUid = auth.currentUser?.uid;
      await clearLocalProductivity(currentUid);
    }
    productivityRuntime.loadedForUid = null;
    set({
      goals: [],
      habits: [],
      streak: 0,
      lastCompletedDate: undefined,
      lastResetDate: undefined,
      weeklyHistory: [],
      totalXp: 0,
      // Las marcas huérfanas no rompen nada (ningún timeline las iguala),
      // pero dejarlas es deuda: el próximo ingreso arranca limpio de verdad.
      seededGoalIds: [],
      seededHabitIds: [],
      stateLoaded: false,
      localLoaded: false,
      syncStatus: 'local',
      lastSyncedAt: null,
    });
  },
});
