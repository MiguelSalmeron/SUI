import type { Goal, Habit } from '@/shared/types/models';
import type { DailySnapshot } from '../model/gamification';
import { metadataKey, upsertById } from './envelope';
import type {
  CloudChange,
  CloudMetadataV2,
  ProductivityData,
  ProductivityEnvelopeV9,
  SerializedTimestamp,
  SummaryChange,
  SyncMetadata,
  SyncMutation,
} from '../sync/syncTypes';

/**
 * Aplicación de lo que baja de la nube y rebase de lo pendiente.
 *
 * La regla es que lo que baja nunca descarta un cambio local que aún no subió:
 * por eso `rebasePendingMutations` existe y se corre después de aplicar los
 * cambios remotos.
 */

const timestampIso = (value?: SerializedTimestamp): string | undefined =>
  value
    ? new Date(value.seconds * 1000 + Math.floor(value.nanoseconds / 1_000_000)).toISOString()
    : undefined;

export const localMetadata = (
  meta: CloudMetadataV2,
  serverUpdatedAt: SerializedTimestamp,
): SyncMetadata => ({
  schemaVersion: 2,
  serverRevision: meta.serverRevision,
  localRevision: 0,
  updatedAt: meta.clientUpdatedAt,
  serverUpdatedAt: timestampIso(serverUpdatedAt),
  deviceId: meta.originDeviceId,
  fingerprint: meta.fingerprint,
  lastMutationId: meta.lastMutationId,
  deletedAt: timestampIso(meta.deletedAt),
  purgeAfter: timestampIso(meta.purgeAfter),
});

export const applyCloudChanges = (
  data: ProductivityData,
  metadata: Record<string, SyncMetadata>,
  changes: CloudChange[],
  summary: SummaryChange | null,
): {
  data: ProductivityData;
  metadata: Record<string, SyncMetadata>;
  summaryMeta: SyncMetadata | null;
} => {
  let next = {
    ...data,
    goals: [...data.goals],
    habits: [...data.habits],
    weeklyHistory: [...data.weeklyHistory],
  };
  const nextMetadata = { ...metadata };
  for (const change of changes) {
    nextMetadata[metadataKey(change.entityType, change.entityId)] = localMetadata(
      change.meta,
      change.serverUpdatedAt,
    );
    if (change.entityType === 'goal') {
      next.goals = change.data
        ? upsertById(next.goals, change.data as Goal)
        : next.goals.filter((item) => item.id !== change.entityId);
    } else if (change.entityType === 'habit') {
      next.habits = change.data
        ? upsertById(next.habits, change.data as Habit)
        : next.habits.filter((item) => item.id !== change.entityId);
    } else {
      next.weeklyHistory = change.data
        ? [
            change.data as DailySnapshot,
            ...next.weeklyHistory.filter((item) => item.date !== change.entityId),
          ]
        : next.weeklyHistory.filter((item) => item.date !== change.entityId);
    }
  }
  const summaryMeta = summary ? localMetadata(summary.meta, summary.serverUpdatedAt) : null;
  if (summary) next = { ...next, ...summary.data };
  return { data: next, metadata: nextMetadata, summaryMeta };
};

/**
 * Actualiza la revisión base de las mutaciones pendientes contra lo que ya
 * bajó de la nube. Las que ya quedaron idénticas a la nube se descartan (no
 * hace falta subir lo que ya está); las que tenían base cloud desaparecida se
 * sueltan para que el servidor vuelva a decidir.
 */
export const rebasePendingMutations = (
  mutations: SyncMutation[],
  metadata: Record<string, SyncMetadata>,
  summaryMeta: SyncMetadata | null,
): SyncMutation[] =>
  mutations.flatMap((mutation) => {
    const cloudMeta =
      mutation.entityType === 'summary'
        ? summaryMeta
        : metadata[metadataKey(mutation.entityType, mutation.entityId)];
    if (cloudMeta?.fingerprint === mutation.fingerprint) return [];
    if (!cloudMeta && mutation.baseServerRevision > 0) return [];
    return [{ ...mutation, baseServerRevision: cloudMeta?.serverRevision ?? 0 }];
  });

export const pendingMetadata = (
  cloud: Record<string, SyncMetadata>,
  latest: ProductivityEnvelopeV9,
): Record<string, SyncMetadata> => {
  const metadata = { ...cloud };
  for (const mutation of latest.outbox) {
    if (mutation.entityType === 'summary') continue;
    const current = latest.metadata[metadataKey(mutation.entityType, mutation.entityId)];
    if (current) metadata[metadataKey(mutation.entityType, mutation.entityId)] = current;
  }
  return metadata;
};
