import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { HOME_STATE_KEY } from '../model/homeStorage';
import type { DailySnapshot } from '../model/gamification';
import type { Goal, Habit } from '@/shared/types/models';
import type {
  ProductivityData,
  ProductivityEntityType,
  ProductivityEnvelopeV8,
  ProductivitySummary,
  SyncMetadata,
  SyncMutation,
} from '../sync/syncTypes';

export const PRODUCTIVITY_STORAGE_KEY = 'sui-productivity-v8';
export const LEGACY_PRODUCTIVITY_STORAGE_KEY = 'sui-productivity-v7';
const DEVICE_ID_KEY = '@sui/device-id-v1';
const SUMMARY_ID = 'singleton';

export const EMPTY_PRODUCTIVITY_DATA: ProductivityData = {
  goals: [],
  habits: [],
  streakCount: 0,
  weeklyHistory: [],
  totalXp: 0,
};

export const fingerprintValue = (value: unknown): string => JSON.stringify(value);
export const metadataKey = (type: ProductivityEntityType, id: string): string => `${type}:${id}`;

export const productivitySummary = (data: ProductivityData): ProductivitySummary => ({
  lastResetDate: data.lastResetDate,
  streakCount: data.streakCount,
  lastCompletedDate: data.lastCompletedDate,
  totalXp: data.totalXp,
});

export const getDeviceId = async (): Promise<string> => {
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
};

const normalizeData = (value: Partial<ProductivityData>): ProductivityData => ({
  goals: Array.isArray(value.goals) ? value.goals : [],
  habits: Array.isArray(value.habits) ? value.habits : [],
  lastResetDate: typeof value.lastResetDate === 'string' ? value.lastResetDate : undefined,
  streakCount: typeof value.streakCount === 'number' ? value.streakCount : 0,
  lastCompletedDate:
    typeof value.lastCompletedDate === 'string' ? value.lastCompletedDate : undefined,
  weeklyHistory: Array.isArray(value.weeklyHistory) ? value.weeklyHistory : [],
  totalXp: typeof value.totalXp === 'number' ? value.totalXp : 0,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isValidData = (value: unknown): value is ProductivityData => {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.goals) &&
    value.goals.every((item) => isRecord(item) && typeof item.id === 'string') &&
    Array.isArray(value.habits) &&
    value.habits.every((item) => isRecord(item) && typeof item.id === 'string') &&
    Array.isArray(value.weeklyHistory) &&
    value.weeklyHistory.every((item) => isRecord(item) && typeof item.date === 'string') &&
    typeof value.streakCount === 'number' &&
    Number.isInteger(value.streakCount) &&
    value.streakCount >= 0 &&
    typeof value.totalXp === 'number' &&
    Number.isInteger(value.totalXp) &&
    value.totalXp >= 0 &&
    (value.lastResetDate === undefined || typeof value.lastResetDate === 'string') &&
    (value.lastCompletedDate === undefined || typeof value.lastCompletedDate === 'string')
  );
};

const isValidMetadata = (value: unknown): value is SyncMetadata => {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === 1 &&
    typeof value.updatedAt === 'string' &&
    Number.isInteger(value.revision) &&
    Number(value.revision) >= 1 &&
    typeof value.deviceId === 'string' &&
    value.deviceId.length > 0 &&
    typeof value.fingerprint === 'string' &&
    (value.serverUpdatedAt === undefined || typeof value.serverUpdatedAt === 'string') &&
    (value.deletedAt === undefined || typeof value.deletedAt === 'string')
  );
};

const parseMetadata = (value: unknown): Record<string, SyncMetadata> | null => {
  if (value === undefined) return {};
  if (!isRecord(value) || !Object.values(value).every(isValidMetadata)) return null;
  return value as Record<string, SyncMetadata>;
};

const isValidMutation = (value: unknown): value is SyncMutation => {
  if (!isRecord(value) || !isValidMetadata(value.meta)) return false;
  if (
    typeof value.mutationId !== 'string' ||
    typeof value.entityId !== 'string' ||
    !['goal', 'habit', 'snapshot', 'summary'].includes(String(value.entityType)) ||
    !['upsert', 'delete'].includes(String(value.operation))
  ) {
    return false;
  }
  if (value.operation === 'delete') {
    return value.entityType !== 'summary' && value.payload === null;
  }
  if (!isRecord(value.payload)) return false;
  if (value.entityType === 'summary') {
    return (
      Number.isInteger(value.payload.streakCount) &&
      Number(value.payload.streakCount) >= 0 &&
      Number.isInteger(value.payload.totalXp) &&
      Number(value.payload.totalXp) >= 0
    );
  }
  const identity = value.entityType === 'snapshot' ? value.payload.date : value.payload.id;
  return identity === value.entityId;
};

const parseOutbox = (value: unknown): SyncMutation[] | null => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isValidMutation)) return null;
  return value;
};

const emptyEnvelope = (
  data: ProductivityData = EMPTY_PRODUCTIVITY_DATA,
): ProductivityEnvelopeV8 => ({
  schemaVersion: 8,
  data,
  metadata: {},
  summaryMeta: null,
  outbox: [],
  lastSyncedAt: null,
});

const parseV8 = (raw: string): ProductivityEnvelopeV8 | null => {
  try {
    const value = JSON.parse(raw) as Partial<ProductivityEnvelopeV8>;
    const metadata = parseMetadata(value.metadata);
    const outbox = parseOutbox(value.outbox);
    if (value.schemaVersion !== 8 || !isValidData(value.data) || !metadata || !outbox) return null;
    if (
      value.summaryMeta !== undefined &&
      value.summaryMeta !== null &&
      !isValidMetadata(value.summaryMeta)
    ) {
      return null;
    }
    return {
      schemaVersion: 8,
      data: value.data,
      metadata,
      summaryMeta: value.summaryMeta ?? null,
      outbox,
      lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : null,
    };
  } catch {
    return null;
  }
};

const migrateLegacy = async (): Promise<ProductivityEnvelopeV8> => {
  const v7 = await AsyncStorage.getItem(LEGACY_PRODUCTIVITY_STORAGE_KEY);
  if (v7) {
    try {
      const value = JSON.parse(v7) as {
        schemaVersion?: number;
        data?: Partial<ProductivityData>;
        metadata?: unknown;
        outbox?: unknown;
        lastSyncedAt?: unknown;
      };
      const metadata = parseMetadata(value.metadata);
      const outbox = parseOutbox(value.outbox);
      if (value.schemaVersion === 7 && isValidData(value.data) && metadata && outbox) {
        return {
          schemaVersion: 8,
          data: value.data,
          metadata,
          summaryMeta: null,
          outbox,
          lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : null,
        };
      }
    } catch {}
  }

  const v6 = await AsyncStorage.getItem(HOME_STATE_KEY);
  if (!v6) return emptyEnvelope();
  try {
    return emptyEnvelope(normalizeData(JSON.parse(v6) as Partial<ProductivityData>));
  } catch {
    return emptyEnvelope();
  }
};

export const writeLocalProductivity = async (envelope: ProductivityEnvelopeV8): Promise<void> => {
  await AsyncStorage.setItem(PRODUCTIVITY_STORAGE_KEY, JSON.stringify(envelope));
};

export const loadLocalProductivity = async (): Promise<ProductivityEnvelopeV8> => {
  const current = await AsyncStorage.getItem(PRODUCTIVITY_STORAGE_KEY);
  if (current) {
    const parsed = parseV8(current);
    if (parsed) return parsed;
    await AsyncStorage.removeItem(PRODUCTIVITY_STORAGE_KEY);
  }
  const migrated = await migrateLegacy();
  await writeLocalProductivity(migrated);
  return migrated;
};

const nextMetadata = (
  previous: SyncMetadata | undefined,
  fingerprint: string,
  deviceId: string,
  deletedAt?: string,
): SyncMetadata => ({
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  revision: (previous?.revision ?? 0) + 1,
  deviceId,
  ...(deletedAt ? { deletedAt } : {}),
  fingerprint,
});

const replaceMutation = (outbox: SyncMutation[], mutation: SyncMutation): void => {
  const remaining = outbox.filter(
    (item) => item.entityType !== mutation.entityType || item.entityId !== mutation.entityId,
  );
  outbox.splice(0, outbox.length, ...remaining, mutation);
};

const queueEntity = <T extends Goal | Habit | DailySnapshot>(
  type: ProductivityEntityType,
  id: string,
  value: T,
  metadata: Record<string, SyncMetadata>,
  outbox: SyncMutation[],
  deviceId: string,
): void => {
  const key = metadataKey(type, id);
  const previous = metadata[key];
  const fingerprint = fingerprintValue(value);
  if (previous?.fingerprint === fingerprint && !previous.deletedAt) return;
  const meta = nextMetadata(previous, fingerprint, deviceId);
  metadata[key] = meta;
  replaceMutation(outbox, {
    mutationId: Crypto.randomUUID(),
    entityType: type,
    entityId: id,
    operation: 'upsert',
    payload: value,
    meta,
  });
};

const queueDeleted = (
  type: ProductivityEntityType,
  activeIds: Set<string>,
  metadata: Record<string, SyncMetadata>,
  outbox: SyncMutation[],
  deviceId: string,
): void => {
  const prefix = `${type}:`;
  for (const [key, previous] of Object.entries(metadata)) {
    if (!key.startsWith(prefix) || previous.deletedAt) continue;
    const id = key.slice(prefix.length);
    if (activeIds.has(id)) continue;
    const deletedAt = new Date().toISOString();
    const meta = nextMetadata(previous, 'deleted', deviceId, deletedAt);
    metadata[key] = meta;
    replaceMutation(outbox, {
      mutationId: Crypto.randomUUID(),
      entityType: type,
      entityId: id,
      operation: 'delete',
      payload: null,
      meta,
    });
  }
};

const queueSummary = (
  data: ProductivityData,
  previous: SyncMetadata | null,
  outbox: SyncMutation[],
  deviceId: string,
): SyncMetadata => {
  const summary = productivitySummary(data);
  const fingerprint = fingerprintValue(summary);
  if (previous?.fingerprint === fingerprint && !previous.deletedAt) return previous;
  const meta = nextMetadata(previous ?? undefined, fingerprint, deviceId);
  replaceMutation(outbox, {
    mutationId: Crypto.randomUUID(),
    entityType: 'summary',
    entityId: SUMMARY_ID,
    operation: 'upsert',
    payload: summary,
    meta,
  });
  return meta;
};

export const persistLocalProductivity = async (
  data: ProductivityData,
): Promise<ProductivityEnvelopeV8> => {
  const current = await loadLocalProductivity();
  const deviceId = await getDeviceId();
  const metadata = { ...current.metadata };
  const outbox = [...current.outbox];
  for (const goal of data.goals) queueEntity('goal', goal.id, goal, metadata, outbox, deviceId);
  for (const habit of data.habits)
    queueEntity('habit', habit.id, habit, metadata, outbox, deviceId);
  for (const snapshot of data.weeklyHistory) {
    queueEntity('snapshot', snapshot.date, snapshot, metadata, outbox, deviceId);
  }
  queueDeleted('goal', new Set(data.goals.map((item) => item.id)), metadata, outbox, deviceId);
  queueDeleted('habit', new Set(data.habits.map((item) => item.id)), metadata, outbox, deviceId);
  queueDeleted(
    'snapshot',
    new Set(data.weeklyHistory.map((item) => item.date)),
    metadata,
    outbox,
    deviceId,
  );
  const summaryMeta = queueSummary(data, current.summaryMeta, outbox, deviceId);
  const envelope: ProductivityEnvelopeV8 = {
    ...current,
    data,
    metadata,
    summaryMeta,
    outbox,
  };
  await writeLocalProductivity(envelope);
  return envelope;
};

const upsertById = <T extends { id: string }>(items: T[], value: T): T[] => [
  value,
  ...items.filter((item) => item.id !== value.id),
];

export const applyPendingMutations = (
  data: ProductivityData,
  mutations: SyncMutation[],
): ProductivityData => {
  let next: ProductivityData = {
    ...data,
    goals: [...data.goals],
    habits: [...data.habits],
    weeklyHistory: [...data.weeklyHistory],
  };
  for (const mutation of mutations) {
    if (mutation.entityType === 'summary' && mutation.payload) {
      next = { ...next, ...(mutation.payload as ProductivitySummary) };
    } else if (mutation.entityType === 'goal') {
      next.goals =
        mutation.operation === 'delete'
          ? next.goals.filter((item) => item.id !== mutation.entityId)
          : upsertById(next.goals, mutation.payload as Goal);
    } else if (mutation.entityType === 'habit') {
      next.habits =
        mutation.operation === 'delete'
          ? next.habits.filter((item) => item.id !== mutation.entityId)
          : upsertById(next.habits, mutation.payload as Habit);
    } else if (mutation.entityType === 'snapshot') {
      next.weeklyHistory =
        mutation.operation === 'delete'
          ? next.weeklyHistory.filter((item) => item.date !== mutation.entityId)
          : [
              mutation.payload as DailySnapshot,
              ...next.weeklyHistory.filter((item) => item.date !== mutation.entityId),
            ];
    }
  }
  return next;
};

export const replaceLocalProductivity = async (
  data: ProductivityData,
  metadata: Record<string, SyncMetadata> = {},
  summaryMeta: SyncMetadata | null = null,
): Promise<void> => {
  await writeLocalProductivity({
    schemaVersion: 8,
    data,
    metadata,
    summaryMeta,
    outbox: [],
    lastSyncedAt: new Date().toISOString(),
  });
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
  await AsyncStorage.multiRemove([
    PRODUCTIVITY_STORAGE_KEY,
    LEGACY_PRODUCTIVITY_STORAGE_KEY,
    HOME_STATE_KEY,
  ]);
};
