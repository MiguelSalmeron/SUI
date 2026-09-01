import {
  EMPTY_PRODUCTIVITY_DATA,
  applyCloudChanges,
  applyPendingMutations,
  emptyPullState,
  getDeviceId,
  loadLocalProductivity,
  metadataKey,
  pendingMetadata,
  persistLocalProductivity,
  rebasePendingMutations,
  writeLocalProductivity,
} from '../persistence/productivityRepository';
import { requestProductivitySync } from './syncApi';
import type {
  CloudChange,
  MutationOutcomeV9,
  ProductivityData,
  ProductivityEnvelopeV9,
  PullCursors,
  PullStateV9,
  SerializedTimestamp,
  SummaryChange,
  SyncMetadata,
  SyncMutation,
  SyncRequestV9,
  SyncResponseV9,
} from './syncTypes';

export interface CloudProductivity {
  data: ProductivityData;
  metadata: Record<string, SyncMetadata>;
  summaryMeta: SyncMetadata | null;
  pullState: PullStateV9;
}

export interface ProductivitySyncResult extends CloudProductivity {
  lastSyncedAt: string;
  pending: number;
  accepted: number;
  replayed: number;
  rejected: number;
  collisions: number;
  migratedLegacy: boolean;
  pages: number;
  compacted: number;
  epochResets: number;
}

export interface SyncDependencies {
  persistLocal: typeof persistLocalProductivity;
  loadLocal: typeof loadLocalProductivity;
  writeLocal: typeof writeLocalProductivity;
  requestSync: typeof requestProductivitySync;
  getDeviceId: typeof getDeviceId;
  now: () => string;
}

const defaultDependencies: SyncDependencies = {
  persistLocal: persistLocalProductivity,
  loadLocal: loadLocalProductivity,
  writeLocal: writeLocalProductivity,
  requestSync: requestProductivitySync,
  getDeviceId,
  now: () => new Date().toISOString(),
};

interface PullResult {
  resetRequired: boolean;
  syncEpoch: number;
  cursors: PullCursors;
  changes: CloudChange[];
  summary: SummaryChange | null;
  outcomes: MutationOutcomeV9[];
  pages: number;
  compacted: number;
}

const pullPages = async (
  deviceId: string,
  mode: 'bootstrap' | 'incremental',
  syncEpoch: number | null,
  initialCursors: PullCursors,
  mutations: SyncMutation[],
  requestSync: typeof requestProductivitySync,
): Promise<PullResult> => {
  let cursors = initialCursors;
  let upperBound: SerializedTimestamp | null = null;
  let pendingMutations = mutations;
  let summary: SummaryChange | null = null;
  let outcomes: MutationOutcomeV9[] = [];
  let changes: CloudChange[] = [];
  let compacted = 0;
  let pages = 0;
  let epoch = syncEpoch ?? 0;
  while (true) {
    const request: SyncRequestV9 = {
      schemaVersion: 9,
      deviceId,
      mutations: pendingMutations,
      pull: { mode, syncEpoch, cursors, upperBound },
    };
    const response: SyncResponseV9 = await requestSync(request);
    pages += 1;
    compacted += response.compacted;
    epoch = response.syncEpoch;
    if (response.resetRequired) {
      return {
        resetRequired: true,
        syncEpoch: epoch,
        cursors,
        changes: [],
        summary: null,
        outcomes: [],
        pages,
        compacted,
      };
    }
    changes = [...changes, ...response.changes];
    summary = response.summary ?? summary;
    outcomes = [...outcomes, ...response.outcomes];
    cursors = response.cursors;
    upperBound = response.upperBound;
    if (!response.hasMore) break;
    pendingMutations = [];
  }
  return {
    resetRequired: false,
    syncEpoch: epoch,
    cursors,
    changes,
    summary,
    outcomes,
    pages,
    compacted,
  };
};

const bootstrap = async (
  dependencies: SyncDependencies,
  deviceId: string,
  forceRebase = false,
): Promise<{ envelope: ProductivityEnvelopeV9; pages: number; compacted: number }> => {
  const pulled = await pullPages(
    deviceId,
    'bootstrap',
    null,
    emptyPullState().cursors,
    [],
    dependencies.requestSync,
  );
  const cloud = applyCloudChanges(EMPTY_PRODUCTIVITY_DATA, {}, pulled.changes, pulled.summary);
  const latest = await dependencies.loadLocal();
  const outbox =
    forceRebase || latest.pullState.needsRebase
      ? rebasePendingMutations(latest.outbox, cloud.metadata, cloud.summaryMeta)
      : latest.outbox;
  const next: ProductivityEnvelopeV9 = {
    schemaVersion: 9,
    data: applyPendingMutations(cloud.data, outbox),
    metadata: pendingMetadata(cloud.metadata, { ...latest, outbox }),
    summaryMeta: outbox.some((item) => item.entityType === 'summary')
      ? latest.summaryMeta
      : cloud.summaryMeta,
    outbox,
    pullState: {
      syncEpoch: pulled.syncEpoch,
      cursors: pulled.cursors,
      needsBootstrap: false,
      needsRebase: false,
    },
    lastSyncedAt: latest.lastSyncedAt,
  };
  await dependencies.writeLocal(next);
  return { envelope: next, pages: pulled.pages, compacted: pulled.compacted };
};

const removeMissingAuthoritative = (
  data: ProductivityData,
  metadata: Record<string, SyncMetadata>,
  mutation: SyncMutation,
): { data: ProductivityData; metadata: Record<string, SyncMetadata> } => {
  if (mutation.entityType === 'summary') return { data, metadata };
  const nextMetadata = { ...metadata };
  delete nextMetadata[metadataKey(mutation.entityType, mutation.entityId)];
  if (mutation.entityType === 'goal') {
    return {
      data: { ...data, goals: data.goals.filter((item) => item.id !== mutation.entityId) },
      metadata: nextMetadata,
    };
  }
  if (mutation.entityType === 'habit') {
    return {
      data: { ...data, habits: data.habits.filter((item) => item.id !== mutation.entityId) },
      metadata: nextMetadata,
    };
  }
  return {
    data: {
      ...data,
      weeklyHistory: data.weeklyHistory.filter((item) => item.date !== mutation.entityId),
    },
    metadata: nextMetadata,
  };
};

const applyOutcomeAuthority = (
  data: ProductivityData,
  metadata: Record<string, SyncMetadata>,
  summaryMeta: SyncMetadata | null,
  outcomes: MutationOutcomeV9[],
  snapshot: SyncMutation[],
) => {
  let current = { data, metadata, summaryMeta };
  const mutations = new Map(snapshot.map((item) => [item.mutationId, item]));
  for (const outcome of outcomes) {
    if (outcome.status !== 'rejected') continue;
    const mutation = mutations.get(outcome.mutationId);
    if (!mutation) continue;
    if (outcome.authoritative) {
      const authoritative = outcome.authoritative;
      const cloud =
        'entityType' in authoritative
          ? applyCloudChanges(current.data, current.metadata, [authoritative], null)
          : applyCloudChanges(current.data, current.metadata, [], authoritative);
      current = {
        data: cloud.data,
        metadata: cloud.metadata,
        summaryMeta: 'entityType' in authoritative ? current.summaryMeta : cloud.summaryMeta,
      };
    } else {
      const removed = removeMissingAuthoritative(current.data, current.metadata, mutation);
      current = { ...current, ...removed };
    }
  }
  return current;
};

export const synchronizeProductivity = async (
  _uid: string,
  data: ProductivityData,
  dependencies: SyncDependencies = defaultDependencies,
): Promise<ProductivitySyncResult> => {
  let initial = await dependencies.persistLocal(data);
  const deviceId = await dependencies.getDeviceId();
  let pages = 0;
  let compacted = 0;
  let epochResets = 0;
  let bootstrapped = false;
  if (initial.pullState.needsBootstrap || initial.pullState.syncEpoch === null) {
    const result = await bootstrap(dependencies, deviceId);
    initial = result.envelope;
    pages += result.pages;
    compacted += result.compacted;
    bootstrapped = true;
  }

  const snapshot = initial.outbox.slice(0, 50);
  let pulled = await pullPages(
    deviceId,
    'incremental',
    initial.pullState.syncEpoch,
    initial.pullState.cursors,
    snapshot,
    dependencies.requestSync,
  );
  pages += pulled.pages;
  compacted += pulled.compacted;
  if (pulled.resetRequired) {
    epochResets += 1;
    const result = await bootstrap(dependencies, deviceId, true);
    initial = result.envelope;
    pages += result.pages;
    compacted += result.compacted;
    const retrySnapshot = initial.outbox.slice(0, 50);
    snapshot.splice(0, snapshot.length, ...retrySnapshot);
    pulled = await pullPages(
      deviceId,
      'incremental',
      initial.pullState.syncEpoch,
      initial.pullState.cursors,
      retrySnapshot,
      dependencies.requestSync,
    );
    pages += pulled.pages;
    compacted += pulled.compacted;
    if (pulled.resetRequired) throw new Error('sync-epoch-reset-loop');
  }

  const processed = new Set(pulled.outcomes.map((item) => item.mutationId));
  const latest = await dependencies.loadLocal();
  const remaining = latest.outbox.filter((mutation) => !processed.has(mutation.mutationId));
  const cloud = applyCloudChanges(latest.data, latest.metadata, pulled.changes, pulled.summary);
  const authoritative = applyOutcomeAuthority(
    cloud.data,
    cloud.metadata,
    cloud.summaryMeta,
    pulled.outcomes,
    snapshot,
  );
  const syncedAt = dependencies.now();
  const next: ProductivityEnvelopeV9 = {
    schemaVersion: 9,
    data: applyPendingMutations(authoritative.data, remaining),
    metadata: pendingMetadata(authoritative.metadata, { ...latest, outbox: remaining }),
    summaryMeta: remaining.some((item) => item.entityType === 'summary')
      ? latest.summaryMeta
      : authoritative.summaryMeta,
    outbox: remaining,
    pullState: {
      syncEpoch: pulled.syncEpoch,
      cursors: pulled.cursors,
      needsBootstrap: false,
      needsRebase: false,
    },
    lastSyncedAt: syncedAt,
  };
  await dependencies.writeLocal(next);
  return {
    data: next.data,
    metadata: next.metadata,
    summaryMeta: next.summaryMeta,
    pullState: next.pullState,
    lastSyncedAt: syncedAt,
    pending: remaining.length,
    accepted: pulled.outcomes.filter((item) => item.status === 'applied').length,
    replayed: pulled.outcomes.filter((item) => item.status === 'replayed').length,
    rejected: pulled.outcomes.filter((item) => item.status === 'rejected').length,
    collisions: 0,
    migratedLegacy: bootstrapped,
    pages,
    compacted,
    epochResets,
  };
};

export const pullCloudProductivity = async (
  _uid: string,
  dependencies: SyncDependencies = defaultDependencies,
): Promise<CloudProductivity> => {
  const deviceId = await dependencies.getDeviceId();
  const pulled = await pullPages(
    deviceId,
    'bootstrap',
    null,
    emptyPullState().cursors,
    [],
    dependencies.requestSync,
  );
  const cloud = applyCloudChanges(EMPTY_PRODUCTIVITY_DATA, {}, pulled.changes, pulled.summary);
  return {
    ...cloud,
    pullState: {
      syncEpoch: pulled.syncEpoch,
      cursors: pulled.cursors,
      needsBootstrap: false,
      needsRebase: false,
    },
  };
};
