import type {
  DailySnapshot,
  Goal,
  Habit,
  ProductivitySummary,
  PullCursors,
  SyncMutationV9,
} from '@sui/contracts';

export type {
  CloudChange,
  CloudMetadataV2,
  MutationOutcomeV9,
  ProductivityEntityType,
  ProductivitySummary,
  PullCursors,
  SerializedTimestamp,
  SummaryChange,
  SyncEntityType,
  SyncPayload,
  SyncRequestV9,
  SyncResponseV9,
  TimestampCursor,
} from '@sui/contracts';

export type SyncStatus = 'local' | 'pending' | 'syncing' | 'synced' | 'offline' | 'error';

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

export type SyncMutation = SyncMutationV9;

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
