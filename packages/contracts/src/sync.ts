/**
 * Protocolo de sincronización v9 (local-first).
 *
 * Define el contrato de request/response del endpoint batch, las entidades en
 * vuelo, la metadata cloud y los parsers runtime que rechazan payloads que no
 * respetan el esquema. El servidor asigna revisiones; el cliente nunca escribe
 * productividad directamente en Firestore.
 */

import type {
  DailySnapshot,
  Goal,
  Habit,
  ProductivityEntityType,
  ProductivitySummary,
} from './productivity';
import {
  isCursors,
  isGoal,
  isHabit,
  isMutation,
  isRecord,
  isSnapshot,
  isSummaryData,
  isTimestamp,
  nonEmptyString,
  nonNegativeInteger,
} from './validation';

export const SYNC_SCHEMA_VERSION = 9 as const;
export const MAX_SYNC_MUTATIONS = 50;
export const MAX_SYNC_REQUEST_BYTES = 256_000;

export type SyncEntityType = ProductivityEntityType | 'summary';
export type MutationOperation = 'upsert' | 'delete';

export interface SerializedTimestamp {
  seconds: number;
  nanoseconds: number;
}

export interface TimestampCursor extends SerializedTimestamp {
  documentId: string;
}

export interface PullCursors {
  goals: TimestampCursor | null;
  habits: TimestampCursor | null;
  snapshots: TimestampCursor | null;
}

export type SyncPayload = Goal | Habit | DailySnapshot | ProductivitySummary | null;

export interface SyncMutationV9 {
  mutationId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: MutationOperation;
  payload: SyncPayload;
  baseServerRevision: number;
  deviceId: string;
  clientUpdatedAt: string;
  fingerprint: string;
}

export interface SyncRequestV9 {
  schemaVersion: typeof SYNC_SCHEMA_VERSION;
  deviceId: string;
  mutations: SyncMutationV9[];
  pull: {
    mode: 'bootstrap' | 'incremental';
    syncEpoch: number | null;
    cursors: PullCursors;
    upperBound: SerializedTimestamp | null;
  };
}

export interface CloudMetadataV2 {
  schemaVersion: 2;
  serverRevision: number;
  originDeviceId: string;
  clientUpdatedAt: string;
  fingerprint: string;
  lastMutationId: string;
  deletedAt?: SerializedTimestamp;
  purgeAfter?: SerializedTimestamp;
}

export interface CloudChange {
  entityType: ProductivityEntityType;
  entityId: string;
  data: Goal | Habit | DailySnapshot | null;
  meta: CloudMetadataV2;
  serverUpdatedAt: SerializedTimestamp;
}

export interface SummaryChange {
  data: ProductivitySummary;
  meta: CloudMetadataV2;
  serverUpdatedAt: SerializedTimestamp;
}

export interface MutationOutcomeV9 {
  mutationId: string;
  status: 'applied' | 'replayed' | 'rejected';
  serverRevision: number;
  reason?: 'stale' | 'missing';
  authoritative?: CloudChange | SummaryChange | null;
}

export interface SyncResponseV9 {
  schemaVersion: typeof SYNC_SCHEMA_VERSION;
  resetRequired: boolean;
  syncEpoch: number;
  compacted: number;
  outcomes: MutationOutcomeV9[];
  changes: CloudChange[];
  summary: SummaryChange | null;
  cursors: PullCursors;
  upperBound: SerializedTimestamp;
  hasMore: boolean;
}

export const parseSyncRequest = (value: unknown): SyncRequestV9 | null => {
  if (!isRecord(value) || JSON.stringify(value).length > MAX_SYNC_REQUEST_BYTES) return null;
  if (
    value.schemaVersion !== SYNC_SCHEMA_VERSION ||
    !nonEmptyString(value.deviceId, 128) ||
    !Array.isArray(value.mutations) ||
    value.mutations.length > MAX_SYNC_MUTATIONS ||
    !isRecord(value.pull) ||
    (value.pull.mode !== 'bootstrap' && value.pull.mode !== 'incremental') ||
    !(value.pull.syncEpoch === null || nonNegativeInteger(value.pull.syncEpoch)) ||
    !isCursors(value.pull.cursors) ||
    !(value.pull.upperBound === null || isTimestamp(value.pull.upperBound))
  )
    return null;
  if (!value.mutations.every((mutation) => isMutation(mutation, value.deviceId as string)))
    return null;
  const entityKeys = new Set<string>();
  const mutationIds = new Set<string>();
  for (const mutation of value.mutations as SyncMutationV9[]) {
    const key = `${mutation.entityType}:${mutation.entityId}`;
    if (entityKeys.has(key) || mutationIds.has(mutation.mutationId)) return null;
    entityKeys.add(key);
    mutationIds.add(mutation.mutationId);
  }
  return value as unknown as SyncRequestV9;
};

const isMetadata = (value: unknown): value is CloudMetadataV2 =>
  isRecord(value) &&
  value.schemaVersion === 2 &&
  nonNegativeInteger(value.serverRevision) &&
  typeof value.originDeviceId === 'string' &&
  typeof value.clientUpdatedAt === 'string' &&
  typeof value.fingerprint === 'string' &&
  typeof value.lastMutationId === 'string' &&
  (value.deletedAt === undefined || isTimestamp(value.deletedAt)) &&
  (value.purgeAfter === undefined || isTimestamp(value.purgeAfter));

const isChange = (value: unknown): value is CloudChange => {
  if (
    !isRecord(value) ||
    !['goal', 'habit', 'snapshot'].includes(String(value.entityType)) ||
    typeof value.entityId !== 'string' ||
    !isMetadata(value.meta) ||
    !isTimestamp(value.serverUpdatedAt)
  )
    return false;
  if (value.data === null) return true;
  if (value.entityType === 'goal') return isGoal(value.data, value.entityId);
  if (value.entityType === 'habit') return isHabit(value.data, value.entityId);
  return isSnapshot(value.data, value.entityId);
};

const isSummaryChange = (value: unknown): value is SummaryChange =>
  isRecord(value) &&
  isSummaryData(value.data) &&
  isMetadata(value.meta) &&
  isTimestamp(value.serverUpdatedAt);

const isOutcome = (value: unknown): value is MutationOutcomeV9 =>
  isRecord(value) &&
  typeof value.mutationId === 'string' &&
  ['applied', 'replayed', 'rejected'].includes(String(value.status)) &&
  nonNegativeInteger(value.serverRevision) &&
  (value.reason === undefined || value.reason === 'stale' || value.reason === 'missing') &&
  (value.authoritative === undefined ||
    value.authoritative === null ||
    isChange(value.authoritative) ||
    isSummaryChange(value.authoritative));

export const parseSyncResponse = (value: unknown): SyncResponseV9 | null => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== SYNC_SCHEMA_VERSION ||
    typeof value.resetRequired !== 'boolean' ||
    !nonNegativeInteger(value.syncEpoch) ||
    !nonNegativeInteger(value.compacted) ||
    !Array.isArray(value.outcomes) ||
    !value.outcomes.every(isOutcome) ||
    !Array.isArray(value.changes) ||
    !value.changes.every(isChange) ||
    !(value.summary === null || isSummaryChange(value.summary)) ||
    !isCursors(value.cursors) ||
    !isTimestamp(value.upperBound) ||
    typeof value.hasMore !== 'boolean'
  )
    return null;
  return value as unknown as SyncResponseV9;
};
