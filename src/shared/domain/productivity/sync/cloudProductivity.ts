import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore';
import type { DailySnapshot } from '../model/gamification';
import type { Goal, Habit } from '@/shared/types/models';
import { resolveMetadataConflict } from './conflictResolution';
import type {
  CloudMutationResult,
  CloudSyncMetadata,
  MutationOutcome,
  ProductivityData,
  ProductivityEntityType,
  ProductivitySummary,
  SyncMetadata,
  SyncMutation,
  SyncedEntity,
} from './syncTypes';

export interface CloudProductivity {
  data: ProductivityData;
  metadata: Record<string, SyncMetadata>;
  summaryMeta: SyncMetadata | null;
  migratedLegacy: boolean;
}

const resolveDatabase = async (database?: Firestore): Promise<Firestore> =>
  database ?? (await import('@/shared/infrastructure/firebase/firebase')).db;

const collectionName = (type: ProductivityEntityType): 'goals' | 'habits' | 'snapshots' => {
  if (type === 'goal') return 'goals';
  if (type === 'habit') return 'habits';
  return 'snapshots';
};

const metadataKey = (type: ProductivityEntityType, id: string): string => `${type}:${id}`;

const timestampToIso = (value: unknown): string | undefined => {
  const timestamp = value as { toDate?: () => Date } | undefined;
  return timestamp?.toDate?.().toISOString();
};

const readCollection = async <T>(
  uid: string,
  name: 'goals' | 'habits' | 'snapshots',
  database: Firestore,
) => {
  const snapshot = await getDocs(collection(database, 'users', uid, name));
  const values: T[] = [];
  const metadata: Record<string, SyncMetadata> = {};
  for (const item of snapshot.docs) {
    const entity = item.data() as SyncedEntity<T> & { serverUpdatedAt?: unknown };
    if (!entity.meta) continue;
    const type: ProductivityEntityType =
      name === 'goals' ? 'goal' : name === 'habits' ? 'habit' : 'snapshot';
    metadata[metadataKey(type, item.id)] = {
      ...entity.meta,
      serverUpdatedAt: timestampToIso(entity.serverUpdatedAt) ?? entity.meta.serverUpdatedAt,
    };
    if (entity.data && !entity.meta.deletedAt) values.push(entity.data);
  }
  return { values, metadata, documentCount: snapshot.size };
};

const summaryFromRoot = (root: Record<string, unknown> | null): ProductivitySummary => {
  const summary = ((root?.productivity as Record<string, unknown> | undefined) ??
    root ??
    {}) as Record<string, unknown>;
  return {
    lastResetDate: typeof summary.lastResetDate === 'string' ? summary.lastResetDate : undefined,
    streakCount: typeof summary.streakCount === 'number' ? summary.streakCount : 0,
    lastCompletedDate:
      typeof summary.lastCompletedDate === 'string' ? summary.lastCompletedDate : undefined,
    totalXp: typeof summary.totalXp === 'number' ? summary.totalXp : 0,
  };
};

const summaryMetadataFromRoot = (root: Record<string, unknown> | null): SyncMetadata | null => {
  const productivity = root?.productivity as Record<string, unknown> | undefined;
  const meta = productivity?.meta as CloudSyncMetadata | undefined;
  if (!meta) return null;
  return {
    ...meta,
    serverUpdatedAt: timestampToIso(productivity?.serverUpdatedAt) ?? meta.serverUpdatedAt,
  };
};

export const loadCloudProductivity = async (
  uid: string,
  database?: Firestore,
): Promise<CloudProductivity | null> => {
  const firestore = await resolveDatabase(database);
  const rootRef = doc(firestore, 'users', uid);
  const [rootSnapshot, goals, habits, snapshots] = await Promise.all([
    getDoc(rootRef),
    readCollection<Goal>(uid, 'goals', firestore),
    readCollection<Habit>(uid, 'habits', firestore),
    readCollection<DailySnapshot>(uid, 'snapshots', firestore),
  ]);
  const root = rootSnapshot.exists() ? (rootSnapshot.data() as Record<string, unknown>) : null;
  const hasEntityDocuments = [goals, habits, snapshots].some((result) => result.documentCount > 0);
  if (!root && !hasEntityDocuments) return null;

  const legacyGoals = Array.isArray(root?.goals) ? (root.goals as Goal[]) : [];
  const legacyHabits = Array.isArray(root?.habits) ? (root.habits as Habit[]) : [];
  const legacyHistory = Array.isArray(root?.weeklyHistory)
    ? (root.weeklyHistory as DailySnapshot[])
    : [];
  const migratedLegacy =
    !hasEntityDocuments &&
    (legacyGoals.length > 0 || legacyHabits.length > 0 || legacyHistory.length > 0);
  const summary = summaryFromRoot(root);

  return {
    data: {
      goals: hasEntityDocuments ? goals.values : legacyGoals,
      habits: hasEntityDocuments ? habits.values : legacyHabits,
      weeklyHistory: hasEntityDocuments ? snapshots.values : legacyHistory,
      ...summary,
    },
    metadata: { ...goals.metadata, ...habits.metadata, ...snapshots.metadata },
    summaryMeta: summaryMetadataFromRoot(root),
    migratedLegacy,
  };
};

const mutationOutcome = (
  mutation: SyncMutation,
  current?: CloudSyncMetadata,
): Pick<MutationOutcome, 'status' | 'collision'> => {
  if (current?.lastMutationId === mutation.mutationId) {
    return { status: 'replayed', collision: false };
  }
  const decision = resolveMetadataConflict(mutation.meta, current);
  if (decision === 'incoming') return { status: 'applied', collision: false };
  if (decision === 'equal') return { status: 'replayed', collision: false };
  return { status: 'rejected', collision: decision === 'collision' };
};

const applyEntityMutation = async (
  uid: string,
  mutation: SyncMutation,
  database: Firestore,
): Promise<MutationOutcome> => {
  const type = mutation.entityType as ProductivityEntityType;
  const ref = doc(database, 'users', uid, collectionName(type), mutation.entityId);
  const outcome = await runTransaction(database, async (transaction) => {
    const current = await transaction.get(ref);
    const currentMeta = current.data()?.meta as CloudSyncMetadata | undefined;
    const next = mutationOutcome(mutation, currentMeta);
    if (next.status !== 'applied') return next;
    transaction.set(
      ref,
      {
        data: mutation.operation === 'delete' ? null : mutation.payload,
        meta: { ...mutation.meta, lastMutationId: mutation.mutationId },
        serverUpdatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return next;
  });
  return { mutationId: mutation.mutationId, ...outcome };
};

const applySummaryMutation = async (
  uid: string,
  mutation: SyncMutation,
  database: Firestore,
): Promise<MutationOutcome> => {
  const ref: DocumentReference = doc(database, 'users', uid);
  const outcome = await runTransaction(database, async (transaction) => {
    const current = await transaction.get(ref);
    const currentMeta = current.data()?.productivity?.meta as CloudSyncMetadata | undefined;
    const next = mutationOutcome(mutation, currentMeta);
    if (next.status !== 'applied') return next;
    const summary = mutation.payload as ProductivitySummary;
    transaction.set(
      ref,
      {
        schemaVersion: 8,
        productivity: {
          lastResetDate: summary.lastResetDate ?? null,
          streakCount: summary.streakCount,
          lastCompletedDate: summary.lastCompletedDate ?? null,
          totalXp: summary.totalXp,
          meta: { ...mutation.meta, lastMutationId: mutation.mutationId },
          serverUpdatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return next;
  });
  return { mutationId: mutation.mutationId, ...outcome };
};

export const applyCloudMutations = async (
  uid: string,
  mutations: SyncMutation[],
  database?: Firestore,
): Promise<CloudMutationResult> => {
  const firestore = await resolveDatabase(database);
  const outcomes: MutationOutcome[] = [];
  for (const mutation of mutations) {
    outcomes.push(
      mutation.entityType === 'summary'
        ? await applySummaryMutation(uid, mutation, firestore)
        : await applyEntityMutation(uid, mutation, firestore),
    );
  }
  return {
    outcomes,
    accepted: outcomes.filter((item) => item.status === 'applied').length,
    replayed: outcomes.filter((item) => item.status === 'replayed').length,
    rejected: outcomes.filter((item) => item.status === 'rejected').length,
    collisions: outcomes.filter((item) => item.collision).length,
  };
};

export const deleteCloudProductivity = async (uid: string, database?: Firestore): Promise<void> => {
  const firestore = await resolveDatabase(database);
  for (const name of ['goals', 'habits', 'snapshots']) {
    const snapshot = await getDocs(collection(firestore, 'users', uid, name));
    for (let index = 0; index < snapshot.docs.length; index += 400) {
      const batch = writeBatch(firestore);
      for (const item of snapshot.docs.slice(index, index + 400)) batch.delete(item.ref);
      await batch.commit();
    }
  }
  await deleteDoc(doc(firestore, 'users', uid));
};
