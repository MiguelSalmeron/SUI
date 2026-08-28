import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/firebase';
import type { DailySnapshot } from './gamification';
import type { Goal, Habit } from '@/shared/types/models';
import type {
  ProductivityData,
  SyncEntityType,
  SyncMetadata,
  SyncMutation,
  SyncedEntity,
} from './syncTypes';

export interface CloudProductivity {
  data: ProductivityData;
  metadata: Record<string, SyncMetadata>;
  migratedLegacy: boolean;
}

const collectionName = (type: SyncEntityType): 'goals' | 'habits' | 'snapshots' => {
  if (type === 'goal') return 'goals';
  if (type === 'habit') return 'habits';
  return 'snapshots';
};

const metadataKey = (type: SyncEntityType, id: string) => `${type}:${id}`;

const readCollection = async <T>(uid: string, name: string) => {
  const snapshot = await getDocs(collection(db, 'users', uid, name));
  const values: T[] = [];
  const metadata: Record<string, SyncMetadata> = {};
  for (const item of snapshot.docs) {
    const entity = item.data() as SyncedEntity<T>;
    if (!entity.meta) continue;
    const type = name === 'goals' ? 'goal' : name === 'habits' ? 'habit' : 'snapshot';
    const serverValue = item.data().serverUpdatedAt as { toDate?: () => Date } | undefined;
    metadata[metadataKey(type, item.id)] = {
      ...entity.meta,
      serverUpdatedAt: serverValue?.toDate?.().toISOString() ?? entity.meta.serverUpdatedAt,
    };
    if (entity.data && !entity.meta.deletedAt) values.push(entity.data);
  }
  return { values, metadata, documentCount: snapshot.size };
};

export const loadCloudProductivity = async (uid: string): Promise<CloudProductivity | null> => {
  const rootRef = doc(db, 'users', uid);
  const [rootSnapshot, goals, habits, snapshots] = await Promise.all([
    getDoc(rootRef),
    readCollection<Goal>(uid, 'goals'),
    readCollection<Habit>(uid, 'habits'),
    readCollection<DailySnapshot>(uid, 'snapshots'),
  ]);
  const root = rootSnapshot.exists() ? rootSnapshot.data() : null;
  const hasEntityDocuments = [goals, habits, snapshots]
    .some((result) => result.documentCount > 0);
  if (!root && !hasEntityDocuments) return null;

  const legacyGoals = Array.isArray(root?.goals) ? root.goals as Goal[] : [];
  const legacyHabits = Array.isArray(root?.habits) ? root.habits as Habit[] : [];
  const legacyHistory = Array.isArray(root?.weeklyHistory) ? root.weeklyHistory as DailySnapshot[] : [];
  const summary = (root?.productivity ?? root ?? {}) as Partial<ProductivityData>;
  const migratedLegacy = !hasEntityDocuments && (legacyGoals.length > 0 || legacyHabits.length > 0 || legacyHistory.length > 0);

  return {
    data: {
      goals: hasEntityDocuments ? goals.values : legacyGoals,
      habits: hasEntityDocuments ? habits.values : legacyHabits,
      weeklyHistory: hasEntityDocuments ? snapshots.values : legacyHistory,
      lastResetDate: summary.lastResetDate,
      streakCount: summary.streakCount ?? 0,
      lastCompletedDate: summary.lastCompletedDate,
      totalXp: summary.totalXp ?? 0,
    },
    metadata: { ...goals.metadata, ...habits.metadata, ...snapshots.metadata },
    migratedLegacy,
  };
};

export const applyCloudMutations = async (
  uid: string,
  mutations: SyncMutation[],
  summary: ProductivityData,
): Promise<void> => {
  for (const mutation of mutations) {
    const ref = doc(db, 'users', uid, collectionName(mutation.entityType), mutation.entityId);
    await runTransaction(db, async (transaction) => {
      const current = await transaction.get(ref);
      const currentMutationId = current.data()?.meta?.lastMutationId as string | undefined;
      if (currentMutationId === mutation.mutationId) return;
      transaction.set(ref, {
        data: mutation.operation === 'delete' ? null : mutation.payload,
        meta: { ...mutation.meta, lastMutationId: mutation.mutationId },
        serverUpdatedAt: serverTimestamp(),
      }, { merge: true });
    });
  }

  await setDoc(doc(db, 'users', uid), {
    schemaVersion: 7,
    productivity: {
      lastResetDate: summary.lastResetDate ?? null,
      streakCount: summary.streakCount,
      lastCompletedDate: summary.lastCompletedDate ?? null,
      totalXp: summary.totalXp,
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const deleteCloudProductivity = async (uid: string): Promise<void> => {
  for (const name of ['goals', 'habits', 'snapshots']) {
    const snapshot = await getDocs(collection(db, 'users', uid, name));
    for (let index = 0; index < snapshot.docs.length; index += 400) {
      const batch = writeBatch(db);
      for (const item of snapshot.docs.slice(index, index + 400)) batch.delete(item.ref);
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, 'users', uid));
};
