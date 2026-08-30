import type { DailySnapshot } from '../model/gamification';
import type { Goal, Habit } from '@/shared/types/models';

export type SyncStatus = 'local' | 'pending' | 'syncing' | 'synced' | 'offline' | 'error';
export type ProductivityEntityType = 'goal' | 'habit' | 'snapshot';
export type SyncEntityType = ProductivityEntityType | 'summary';

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

export interface PullStateV9 {
  syncEpoch: number | null;
  cursors: PullCursors;
  needsBootstrap: boolean;
  needsRebase: boolean;
}

export interface SyncMetadata {
  schemaVersion: 2;
  serverRevision: number;
  localRevision: number;
  updatedAt: string;
  serverUpdatedAt?: string;
  deviceId: string;
  fingerprint: string;
  lastMutationId?: string;
  deletedAt?: string;
  purgeAfter?: string;
}

export interface ProductivitySummary {
  lastResetDate?: string;
  streakCount: number;
  lastCompletedDate?: string;
  totalXp: number;
}

export type SyncPayload = Goal | Habit | DailySnapshot | ProductivitySummary | null;

export interface SyncMutation {
  mutationId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: SyncPayload;
  baseServerRevision: number;
  deviceId: string;
  clientUpdatedAt: string;
  fingerprint: string;
}

export interface ProductivityData extends ProductivitySummary {
  goals: Goal[];
  habits: Habit[];
  weeklyHistory: DailySnapshot[];
}

export interface ProductivityEnvelopeV9 {
  schemaVersion: 9;
  data: ProductivityData;
  metadata: Record<string, SyncMetadata>;
  summaryMeta: SyncMetadata | null;
  outbox: SyncMutation[];
  pullState: PullStateV9;
  lastSyncedAt: string | null;
}

export type ProductivityEnvelope = ProductivityEnvelopeV9;

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

export interface SyncRequestV9 {
  schemaVersion: 9;
  deviceId: string;
  mutations: SyncMutation[];
  pull: {
    mode: 'bootstrap' | 'incremental';
    syncEpoch: number | null;
    cursors: PullCursors;
    upperBound: SerializedTimestamp | null;
  };
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
