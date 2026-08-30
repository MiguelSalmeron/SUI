import {
  applyPendingMutations,
  loadLocalProductivity,
  persistLocalProductivity,
  writeLocalProductivity,
} from '../persistence/productivityRepository';
import {
  applyCloudMutations,
  loadCloudProductivity,
  type CloudProductivity,
} from './cloudProductivity';
import type {
  CloudMutationResult,
  ProductivityData,
  ProductivityEnvelopeV8,
  SyncMetadata,
} from './syncTypes';

export interface ProductivitySyncResult {
  data: ProductivityData;
  metadata: Record<string, SyncMetadata>;
  summaryMeta: SyncMetadata | null;
  lastSyncedAt: string;
  pending: number;
  accepted: number;
  replayed: number;
  rejected: number;
  collisions: number;
  migratedLegacy: boolean;
}

export interface SyncDependencies {
  persistLocal: typeof persistLocalProductivity;
  loadLocal: typeof loadLocalProductivity;
  writeLocal: typeof writeLocalProductivity;
  applyCloud: typeof applyCloudMutations;
  loadCloud: typeof loadCloudProductivity;
  now: () => string;
}

const defaultDependencies: SyncDependencies = {
  persistLocal: persistLocalProductivity,
  loadLocal: loadLocalProductivity,
  writeLocal: writeLocalProductivity,
  applyCloud: applyCloudMutations,
  loadCloud: loadCloudProductivity,
  now: () => new Date().toISOString(),
};

const emptyMutationResult = (): CloudMutationResult => ({
  outcomes: [],
  accepted: 0,
  replayed: 0,
  rejected: 0,
  collisions: 0,
});

const pendingMetadata = (
  cloud: Record<string, SyncMetadata>,
  latest: ProductivityEnvelopeV8,
): Record<string, SyncMetadata> => {
  const metadata = { ...cloud };
  for (const mutation of latest.outbox) {
    if (mutation.entityType === 'summary') continue;
    metadata[`${mutation.entityType}:${mutation.entityId}`] = mutation.meta;
  }
  return metadata;
};

export const synchronizeProductivity = async (
  uid: string,
  data: ProductivityData,
  dependencies: SyncDependencies = defaultDependencies,
): Promise<ProductivitySyncResult> => {
  const initial = await dependencies.persistLocal(data);
  const snapshot = [...initial.outbox];
  const mutationResult =
    snapshot.length > 0 ? await dependencies.applyCloud(uid, snapshot) : emptyMutationResult();
  const processed = new Set(mutationResult.outcomes.map((item) => item.mutationId));
  const latest = await dependencies.loadLocal();
  const remaining = latest.outbox.filter((mutation) => !processed.has(mutation.mutationId));
  const cloud = await dependencies.loadCloud(uid);
  const syncedAt = dependencies.now();

  if (!cloud) {
    const next = { ...latest, outbox: remaining, lastSyncedAt: syncedAt };
    await dependencies.writeLocal(next);
    return {
      data: next.data,
      metadata: next.metadata,
      summaryMeta: next.summaryMeta,
      lastSyncedAt: syncedAt,
      pending: remaining.length,
      accepted: mutationResult.accepted,
      replayed: mutationResult.replayed,
      rejected: mutationResult.rejected,
      collisions: mutationResult.collisions,
      migratedLegacy: false,
    };
  }

  const dataWithPending = applyPendingMutations(cloud.data, remaining);
  const summaryPending = remaining.some((mutation) => mutation.entityType === 'summary');
  const next: ProductivityEnvelopeV8 = {
    schemaVersion: 8,
    data: dataWithPending,
    metadata: pendingMetadata(cloud.metadata, { ...latest, outbox: remaining }),
    summaryMeta: summaryPending ? latest.summaryMeta : cloud.summaryMeta,
    outbox: remaining,
    lastSyncedAt: syncedAt,
  };
  await dependencies.writeLocal(next);
  return {
    data: next.data,
    metadata: next.metadata,
    summaryMeta: next.summaryMeta,
    lastSyncedAt: syncedAt,
    pending: remaining.length,
    accepted: mutationResult.accepted,
    replayed: mutationResult.replayed,
    rejected: mutationResult.rejected,
    collisions: mutationResult.collisions,
    migratedLegacy: cloud.migratedLegacy,
  };
};

export const pullCloudProductivity = (uid: string): Promise<CloudProductivity | null> =>
  loadCloudProductivity(uid);
