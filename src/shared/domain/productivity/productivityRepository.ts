import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { HOME_STATE_KEY } from './homeStorage';
import { applyCloudMutations, loadCloudProductivity, type CloudProductivity } from './userData';
import type { DailySnapshot } from './gamification';
import type { Goal, Habit } from '@/shared/types/models';
import type {
  ProductivityData,
  ProductivityEnvelope,
  SyncEntityType,
  SyncMetadata,
  SyncMutation,
} from './syncTypes';

export const PRODUCTIVITY_STORAGE_KEY = 'sui-productivity-v7';
const DEVICE_ID_KEY = '@sui/device-id-v1';

const EMPTY_DATA: ProductivityData = {
  goals: [],
  habits: [],
  streakCount: 0,
  weeklyHistory: [],
  totalXp: 0,
};

const fingerprint = (value: unknown) => JSON.stringify(value);
const metaKey = (type: SyncEntityType, id: string) => `${type}:${id}`;

export const getDeviceId = async (): Promise<string> => {
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
};

const legacyToData = (value: Partial<ProductivityData>): ProductivityData => ({
  goals: Array.isArray(value.goals) ? value.goals : [],
  habits: Array.isArray(value.habits) ? value.habits : [],
  lastResetDate: value.lastResetDate,
  streakCount: value.streakCount ?? 0,
  lastCompletedDate: value.lastCompletedDate,
  weeklyHistory: Array.isArray(value.weeklyHistory) ? value.weeklyHistory : [],
  totalXp: value.totalXp ?? 0,
});

const emptyEnvelope = (data: ProductivityData = EMPTY_DATA): ProductivityEnvelope => ({
  schemaVersion: 7,
  data,
  metadata: {},
  outbox: [],
  lastSyncedAt: null,
});

export const loadLocalProductivity = async (): Promise<ProductivityEnvelope> => {
  const current = await AsyncStorage.getItem(PRODUCTIVITY_STORAGE_KEY);
  if (current) {
    try {
      const parsed = JSON.parse(current) as Partial<ProductivityEnvelope>;
      if (parsed.schemaVersion === 7 && parsed.data && typeof parsed.data === 'object') {
        return {
          schemaVersion: 7,
          data: legacyToData(parsed.data),
          metadata: parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : {},
          outbox: Array.isArray(parsed.outbox) ? parsed.outbox : [],
          lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
        };
      }
    } catch {
      await AsyncStorage.removeItem(PRODUCTIVITY_STORAGE_KEY);
    }
  }
  const legacy = await AsyncStorage.getItem(HOME_STATE_KEY);
  let legacyData = EMPTY_DATA;
  if (legacy) {
    try {
      legacyData = legacyToData(JSON.parse(legacy) as Partial<ProductivityData>);
    } catch {
      legacyData = EMPTY_DATA;
    }
  }
  const envelope = emptyEnvelope(legacyData);
  await AsyncStorage.setItem(PRODUCTIVITY_STORAGE_KEY, JSON.stringify(envelope));
  return envelope;
};

const queueEntity = <T extends Goal | Habit | DailySnapshot>(
  type: SyncEntityType,
  id: string,
  value: T,
  metadata: Record<string, SyncMetadata>,
  outbox: SyncMutation[],
  deviceId: string,
) => {
  const key = metaKey(type, id);
  const previous = metadata[key];
  const nextFingerprint = fingerprint(value);
  if (previous?.fingerprint === nextFingerprint && !previous.deletedAt) return;
  const meta: SyncMetadata = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    revision: (previous?.revision ?? 0) + 1,
    deviceId,
    fingerprint: nextFingerprint,
  };
  metadata[key] = meta;
  const mutation: SyncMutation = {
    mutationId: Crypto.randomUUID(),
    entityType: type,
    entityId: id,
    operation: 'upsert',
    payload: value,
    meta,
  };
  const filtered = outbox.filter((item) => item.entityType !== type || item.entityId !== id);
  outbox.splice(0, outbox.length, ...filtered, mutation);
};

const queueDeleted = (
  type: SyncEntityType,
  activeIds: Set<string>,
  metadata: Record<string, SyncMetadata>,
  outbox: SyncMutation[],
  deviceId: string,
) => {
  const prefix = `${type}:`;
  for (const [key, previous] of Object.entries(metadata)) {
    if (!key.startsWith(prefix) || previous.deletedAt) continue;
    const id = key.slice(prefix.length);
    if (activeIds.has(id)) continue;
    const now = new Date().toISOString();
    const meta: SyncMetadata = {
      ...previous,
      updatedAt: now,
      deletedAt: now,
      revision: previous.revision + 1,
      deviceId,
      fingerprint: 'deleted',
    };
    metadata[key] = meta;
    const mutation: SyncMutation = {
      mutationId: Crypto.randomUUID(),
      entityType: type,
      entityId: id,
      operation: 'delete',
      payload: null,
      meta,
    };
    const filtered = outbox.filter((item) => item.entityType !== type || item.entityId !== id);
    outbox.splice(0, outbox.length, ...filtered, mutation);
  }
};

export const persistLocalProductivity = async (
  data: ProductivityData,
): Promise<ProductivityEnvelope> => {
  const current = await loadLocalProductivity();
  const deviceId = await getDeviceId();
  const metadata = { ...current.metadata };
  const outbox = [...current.outbox];
  for (const goal of data.goals) queueEntity('goal', goal.id, goal, metadata, outbox, deviceId);
  for (const habit of data.habits) queueEntity('habit', habit.id, habit, metadata, outbox, deviceId);
  for (const snapshot of data.weeklyHistory) queueEntity('snapshot', snapshot.date, snapshot, metadata, outbox, deviceId);
  queueDeleted('goal', new Set(data.goals.map((item) => item.id)), metadata, outbox, deviceId);
  queueDeleted('habit', new Set(data.habits.map((item) => item.id)), metadata, outbox, deviceId);
  queueDeleted('snapshot', new Set(data.weeklyHistory.map((item) => item.date)), metadata, outbox, deviceId);
  const envelope: ProductivityEnvelope = { ...current, data, metadata, outbox };
  await AsyncStorage.setItem(PRODUCTIVITY_STORAGE_KEY, JSON.stringify(envelope));
  return envelope;
};

export const flushProductivityOutbox = async (
  uid: string,
  envelope?: ProductivityEnvelope,
): Promise<ProductivityEnvelope> => {
  const current = envelope ?? await loadLocalProductivity();
  await applyCloudMutations(uid, current.outbox, current.data);
  const syncedAt = new Date().toISOString();
  const next: ProductivityEnvelope = {
    ...current,
    outbox: [],
    lastSyncedAt: syncedAt,
    metadata: Object.fromEntries(
      Object.entries(current.metadata).map(([key, meta]) => [key, { ...meta, serverUpdatedAt: syncedAt }]),
    ),
  };
  await AsyncStorage.setItem(PRODUCTIVITY_STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const pullCloudProductivity = (uid: string): Promise<CloudProductivity | null> =>
  loadCloudProductivity(uid);

export const replaceLocalProductivity = async (
  data: ProductivityData,
  metadata: Record<string, SyncMetadata> = {},
): Promise<void> => {
  const envelope: ProductivityEnvelope = {
    schemaVersion: 7,
    data,
    metadata,
    outbox: [],
    lastSyncedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(PRODUCTIVITY_STORAGE_KEY, JSON.stringify(envelope));
};

export const combineProductivity = (
  local: ProductivityData,
  cloud: ProductivityData,
): ProductivityData => {
  const combineById = <T extends { id: string }>(localItems: T[], cloudItems: T[]) => {
    const values = new Map(cloudItems.map((item) => [item.id, item]));
    for (const item of localItems) values.set(item.id, item);
    return [...values.values()];
  };
  const snapshots = new Map(cloud.weeklyHistory.map((item) => [item.date, item]));
  for (const item of local.weeklyHistory) snapshots.set(item.date, item);
  return {
    goals: combineById(local.goals, cloud.goals),
    habits: combineById(local.habits, cloud.habits),
    weeklyHistory: [...snapshots.values()],
    lastResetDate: local.lastResetDate ?? cloud.lastResetDate,
    streakCount: Math.max(local.streakCount, cloud.streakCount),
    lastCompletedDate: local.lastCompletedDate ?? cloud.lastCompletedDate,
    totalXp: Math.max(local.totalXp, cloud.totalXp),
  };
};

export const clearLocalProductivity = async (): Promise<void> => {
  await AsyncStorage.multiRemove([PRODUCTIVITY_STORAGE_KEY, HOME_STATE_KEY]);
};
