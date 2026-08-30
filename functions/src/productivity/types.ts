export type EntityType = 'goal' | 'habit' | 'snapshot' | 'summary';
export type CollectionEntityType = Exclude<EntityType, 'summary'>;
export type MutationOperation = 'upsert' | 'delete';

export interface TimestampCursor {
  seconds: number;
  nanoseconds: number;
  documentId: string;
}

export interface PullCursors {
  goals: TimestampCursor | null;
  habits: TimestampCursor | null;
  snapshots: TimestampCursor | null;
}

export interface SyncMutationV9 {
  mutationId: string;
  entityType: EntityType;
  entityId: string;
  operation: MutationOperation;
  payload: Record<string, unknown> | null;
  baseServerRevision: number;
  deviceId: string;
  clientUpdatedAt: string;
  fingerprint: string;
}

export interface SyncRequestV9 {
  schemaVersion: 9;
  deviceId: string;
  mutations: SyncMutationV9[];
  pull: {
    mode: 'bootstrap' | 'incremental';
    syncEpoch: number | null;
    cursors: PullCursors;
    upperBound: Omit<TimestampCursor, 'documentId'> | null;
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

export interface SerializedTimestamp {
  seconds: number;
  nanoseconds: number;
}

export interface CloudChange {
  entityType: CollectionEntityType;
  entityId: string;
  data: Record<string, unknown> | null;
  meta: CloudMetadataV2;
  serverUpdatedAt: SerializedTimestamp;
}

export interface SummaryChange {
  data: Record<string, unknown>;
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
  schemaVersion: 9;
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
