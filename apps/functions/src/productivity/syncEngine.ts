import { firestoreSyncProvider } from './firestoreSyncProvider';
import { emptyCursors, type SyncProvider } from './provider';
import type {
  MutationOutcomeV9,
  SerializedTimestamp,
  SyncMutationV9,
  SyncRequestV9,
  SyncResponseV9,
} from './types';

export const compactExpiredTombstones = (
  uid: string,
  now: SerializedTimestamp = firestoreSyncProvider.now(),
  provider: SyncProvider = firestoreSyncProvider,
): Promise<{ compacted: number; epoch: number }> => provider.compactExpiredTombstones(uid, now);

export const applyMutationBatch = (
  uid: string,
  mutations: SyncMutationV9[],
  now: SerializedTimestamp = firestoreSyncProvider.now(),
  provider: SyncProvider = firestoreSyncProvider,
): Promise<MutationOutcomeV9[]> => provider.applyMutationBatch(uid, mutations, now);

export const synchronizeProductivityV9 = async (
  uid: string,
  request: SyncRequestV9,
  provider: SyncProvider = firestoreSyncProvider,
): Promise<SyncResponseV9> => {
  const compaction = await provider.compactExpiredTombstones(uid, provider.now());
  const epoch = Math.max(compaction.epoch, await provider.readSyncEpoch(uid));
  const resetRequired = request.pull.mode === 'incremental' && request.pull.syncEpoch !== epoch;
  const upperBound = request.pull.upperBound ?? provider.now();
  if (resetRequired || (request.pull.mode === 'bootstrap' && request.mutations.length > 0)) {
    return {
      schemaVersion: 9,
      resetRequired: true,
      syncEpoch: epoch,
      compacted: compaction.compacted,
      outcomes: [],
      changes: [],
      summary: null,
      cursors: request.pull.cursors ?? emptyCursors(),
      upperBound,
      hasMore: false,
    };
  }

  const outcomes = await provider.applyMutationBatch(uid, request.mutations, provider.now());
  const cursors = request.pull.cursors ?? emptyCursors();
  const continuing = Boolean(request.pull.upperBound);
  const [goals, habits, snapshots, summary, currentEpoch] = await Promise.all([
    provider.readChanges({
      uid,
      entityType: 'goal',
      mode: request.pull.mode,
      cursor: cursors.goals,
      upperBound,
      continuing,
    }),
    provider.readChanges({
      uid,
      entityType: 'habit',
      mode: request.pull.mode,
      cursor: cursors.habits,
      upperBound,
      continuing,
    }),
    provider.readChanges({
      uid,
      entityType: 'snapshot',
      mode: request.pull.mode,
      cursor: cursors.snapshots,
      upperBound,
      continuing,
    }),
    provider.readSummary(uid),
    provider.readSyncEpoch(uid),
  ]);
  return {
    schemaVersion: 9,
    resetRequired: false,
    syncEpoch: currentEpoch,
    compacted: compaction.compacted,
    outcomes,
    changes: [...goals.changes, ...habits.changes, ...snapshots.changes],
    summary,
    cursors: {
      goals: goals.cursor,
      habits: habits.cursor,
      snapshots: snapshots.cursor,
    },
    upperBound,
    hasMore: goals.hasMore || habits.hasMore || snapshots.hasMore,
  };
};
