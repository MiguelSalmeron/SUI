import type { DailySnapshot } from './gamification';
import type { Goal, Habit } from '@/shared/types/models';

export type SyncStatus = 'local' | 'pending' | 'syncing' | 'synced' | 'offline' | 'error';
export type SyncEntityType = 'goal' | 'habit' | 'snapshot';

export interface SyncMetadata {
  schemaVersion: 1;
  updatedAt: string;
  serverUpdatedAt?: string;
  revision: number;
  deviceId: string;
  deletedAt?: string;
  fingerprint: string;
}

export type SyncedEntity<T> = {
  data: T | null;
  meta: SyncMetadata;
};

export interface SyncMutation {
  mutationId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: Goal | Habit | DailySnapshot | null;
  meta: SyncMetadata;
}

export interface ProductivityData {
  goals: Goal[];
  habits: Habit[];
  lastResetDate?: string;
  streakCount: number;
  lastCompletedDate?: string;
  weeklyHistory: DailySnapshot[];
  totalXp: number;
}

export interface ProductivityEnvelope {
  schemaVersion: 7;
  data: ProductivityData;
  metadata: Record<string, SyncMetadata>;
  outbox: SyncMutation[];
  lastSyncedAt: string | null;
}
