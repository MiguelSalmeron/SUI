import type {
  CloudChange,
  MutationOutcomeV9,
  ProductivityEntityType,
  PullCursors,
  SerializedTimestamp,
  SummaryChange,
  SyncMutationV9,
  TimestampCursor,
} from './types';

export interface ChangeQuery {
  uid: string;
  entityType: ProductivityEntityType;
  mode: 'bootstrap' | 'incremental';
  cursor: TimestampCursor | null;
  upperBound: SerializedTimestamp;
  continuing: boolean;
}

export interface ChangePage {
  changes: CloudChange[];
  cursor: TimestampCursor | null;
  hasMore: boolean;
}

export interface SyncProvider {
  now(): SerializedTimestamp;
  compactExpiredTombstones(
    uid: string,
    now: SerializedTimestamp,
  ): Promise<{ compacted: number; epoch: number }>;
  applyMutationBatch(
    uid: string,
    mutations: SyncMutationV9[],
    now: SerializedTimestamp,
  ): Promise<MutationOutcomeV9[]>;
  readSyncEpoch(uid: string): Promise<number>;
  readSummary(uid: string): Promise<SummaryChange | null>;
  readChanges(query: ChangeQuery): Promise<ChangePage>;
}

export const emptyCursors = (): PullCursors => ({ goals: null, habits: null, snapshots: null });
