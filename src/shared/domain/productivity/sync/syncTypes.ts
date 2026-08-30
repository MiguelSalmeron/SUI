import type { DailySnapshot } from '../model/gamification';
import type { Goal, Habit } from '@/shared/types/models';

export type SyncStatus = 'local' | 'pending' | 'syncing' | 'synced' | 'offline' | 'error';
export type ProductivityEntityType = 'goal' | 'habit' | 'snapshot';
export type SyncEntityType = ProductivityEntityType | 'summary';

export interface SyncMetadata {
  schemaVersion: 1;
  updatedAt: string;
  serverUpdatedAt?: string;
  revision: number;
  deviceId: string;
  deletedAt?: string;
  fingerprint: string;
}

export interface CloudSyncMetadata extends SyncMetadata {
  lastMutationId: string;
}

export type SyncedEntity<T> = {
  data: T | null;
  meta: CloudSyncMetadata;
};

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
  meta: SyncMetadata;
}

export interface ProductivityData extends ProductivitySummary {
  goals: Goal[];
  habits: Habit[];
  weeklyHistory: DailySnapshot[];
}

export interface ProductivityEnvelopeV8 {
  schemaVersion: 8;
  data: ProductivityData;
  metadata: Record<string, SyncMetadata>;
  summaryMeta: SyncMetadata | null;
  outbox: SyncMutation[];
  lastSyncedAt: string | null;
}

export type ProductivityEnvelope = ProductivityEnvelopeV8;
export type MutationOutcomeStatus = 'applied' | 'replayed' | 'rejected';

export interface MutationOutcome {
  mutationId: string;
  status: MutationOutcomeStatus;
  collision: boolean;
}

export interface CloudMutationResult {
  outcomes: MutationOutcome[];
  accepted: number;
  replayed: number;
  rejected: number;
  collisions: number;
}
