import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { HOME_STATE_KEY } from '../model/homeStorage';
import type { DailySnapshot } from '../model/gamification';
import type { Goal, Habit } from '@/shared/types/models';
import type {
  CloudChange,
  CloudMetadataV2,
  ProductivityData,
  ProductivityEntityType,
  ProductivityEnvelopeV9,
  ProductivitySummary,
  PullStateV9,
  SerializedTimestamp,
  SummaryChange,
  SyncEntityType,
  SyncMetadata,
  SyncMutation,
} from '../sync/syncTypes';

export const PRODUCTIVITY_STORAGE_KEY = 'sui-productivity-v9';
export const LEGACY_PRODUCTIVITY_V8_STORAGE_KEY = 'sui-productivity-v8';
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

export const emptyPullState = (): PullStateV9 => ({
  syncEpoch: null,
  cursors: { goals: null, habits: null, snapshots: null },
  needsBootstrap: true,
  needsRebase: false,
});

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
    Number.isInteger(value.streakCount) &&
    Number(value.streakCount) >= 0 &&
    Number.isInteger(value.totalXp) &&
    Number(value.totalXp) >= 0 &&
    (value.lastResetDate === undefined || typeof value.lastResetDate === 'string') &&
    (value.lastCompletedDate === undefined || typeof value.lastCompletedDate === 'string')
  );
};

const isTimestamp = (value: unknown): value is SerializedTimestamp =>
  isRecord(value) &&
  Number.isInteger(value.seconds) &&
  Number.isInteger(value.nanoseconds) &&
  Number(value.nanoseconds) >= 0 &&
  Number(value.nanoseconds) < 1_000_000_000;

const isValidMetadata = (value: unknown): value is SyncMetadata =>
  isRecord(value) &&
  value.schemaVersion === 2 &&
  Number.isInteger(value.serverRevision) &&
  Number(value.serverRevision) >= 0 &&
  Number.isInteger(value.localRevision) &&
  Number(value.localRevision) >= 0 &&
  typeof value.updatedAt === 'string' &&
  value.updatedAt.length > 0 &&
  typeof value.deviceId === 'string' &&
  value.deviceId.length > 0 &&
  typeof value.fingerprint === 'string' &&
  (value.lastMutationId === undefined || typeof value.lastMutationId === 'string') &&
  (value.serverUpdatedAt === undefined || typeof value.serverUpdatedAt === 'string') &&
  (value.deletedAt === undefined || typeof value.deletedAt === 'string') &&
  (value.purgeAfter === undefined || typeof value.purgeAfter === 'string');

const isValidMutation = (value: unknown): value is SyncMutation => {
  if (!isRecord(value)) return false;
  if (
    typeof value.mutationId !== 'string' ||
    typeof value.entityId !== 'string' ||
    !['goal', 'habit', 'snapshot', 'summary'].includes(String(value.entityType)) ||
    !['upsert', 'delete'].includes(String(value.operation)) ||
    !Number.isInteger(value.baseServerRevision) ||
    Number(value.baseServerRevision) < 0 ||
    typeof value.deviceId !== 'string' ||
    typeof value.clientUpdatedAt !== 'string' ||
    typeof value.fingerprint !== 'string'
  )
    return false;
  if (value.operation === 'delete') return value.entityType !== 'summary' && value.payload === null;
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

const isPullState = (value: unknown): value is PullStateV9 => {
  if (!isRecord(value) || !isRecord(value.cursors)) return false;
  const validCursor = (cursor: unknown) =>
    cursor === null ||
    (isRecord(cursor) && isTimestamp(cursor) && typeof cursor.documentId === 'string');
  return (
    (value.syncEpoch === null ||
      (Number.isInteger(value.syncEpoch) && Number(value.syncEpoch) >= 0)) &&
    validCursor(value.cursors.goals) &&
    validCursor(value.cursors.habits) &&
    validCursor(value.cursors.snapshots) &&
    typeof value.needsBootstrap === 'boolean' &&
    typeof value.needsRebase === 'boolean'
  );
};

const emptyEnvelope = (
  data: ProductivityData = EMPTY_PRODUCTIVITY_DATA,
): ProductivityEnvelopeV9 => ({
  schemaVersion: 9,
  data,
  metadata: {},
  summaryMeta: null,
  outbox: [],
  pullState: emptyPullState(),
  lastSyncedAt: null,
});

const parseV9 = (raw: string): ProductivityEnvelopeV9 | null => {
  try {
    const value = JSON.parse(raw) as Partial<ProductivityEnvelopeV9>;
    if (
      value.schemaVersion !== 9 ||
      !isValidData(value.data) ||
      !isRecord(value.metadata) ||
      !Object.values(value.metadata).every(isValidMetadata) ||
      (value.summaryMeta !== null &&
        value.summaryMeta !== undefined &&
        !isValidMetadata(value.summaryMeta)) ||
      !Array.isArray(value.outbox) ||
      !value.outbox.every(isValidMutation) ||
      !isPullState(value.pullState)
    )
      return null;
    return {
      schemaVersion: 9,
      data: value.data,
      metadata: value.metadata as Record<string, SyncMetadata>,
      summaryMeta: value.summaryMeta ?? null,
      outbox: value.outbox,
      pullState: value.pullState,
      lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : null,
    };
  } catch {
    return null;
  }
};

interface LegacyMetadata {
  revision?: number;
  updatedAt?: string;
  deviceId?: string;
  fingerprint?: string;
  lastMutationId?: string;
  serverUpdatedAt?: string;
  deletedAt?: string;
}

interface LegacyMutation {
  mutationId?: string;
  entityType?: SyncEntityType;
  entityId?: string;
  operation?: 'upsert' | 'delete';
  payload?: SyncMutation['payload'];
  meta?: LegacyMetadata;
}

const migrateMetadata = (value: unknown): Record<string, SyncMetadata> => {
  if (!isRecord(value)) return {};
  const migrated: Record<string, SyncMetadata> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    const meta = raw as LegacyMetadata;
    if (typeof meta.deviceId !== 'string' || typeof meta.fingerprint !== 'string') continue;
    migrated[key] = {
      schemaVersion: 2,
      serverRevision: 0,
      localRevision: typeof meta.revision === 'number' ? meta.revision : 0,
      updatedAt: meta.updatedAt ?? new Date(0).toISOString(),
      deviceId: meta.deviceId,
      fingerprint: meta.fingerprint,
      ...(meta.lastMutationId ? { lastMutationId: meta.lastMutationId } : {}),
      ...(meta.serverUpdatedAt ? { serverUpdatedAt: meta.serverUpdatedAt } : {}),
      ...(meta.deletedAt ? { deletedAt: meta.deletedAt } : {}),
    };
  }
  return migrated;
};

const migrateOutbox = (value: unknown): SyncMutation[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): SyncMutation[] => {
    if (!isRecord(raw)) return [];
    const mutation = raw as LegacyMutation;
    if (
      typeof mutation.mutationId !== 'string' ||
      typeof mutation.entityId !== 'string' ||
      !mutation.entityType ||
      !mutation.operation ||
      !mutation.meta?.deviceId ||
      !mutation.meta.fingerprint
    )
      return [];
    return [
      {
        mutationId: mutation.mutationId,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        operation: mutation.operation,
        payload: mutation.payload ?? null,
        baseServerRevision: 0,
        deviceId: mutation.meta.deviceId,
        clientUpdatedAt: mutation.meta.updatedAt ?? new Date(0).toISOString(),
        fingerprint: mutation.meta.fingerprint,
      },
    ];
  });
};

interface ProductivityEnvelopeV7 {
  schemaVersion: 7;
  data: ProductivityData;
  metadata: Record<string, unknown>;
  outbox: unknown[];
  lastSyncedAt: string | null;
}

interface ProductivityEnvelopeV8 {
  schemaVersion: 8;
  data: ProductivityData;
  metadata: Record<string, unknown>;
  summaryMeta: unknown;
  outbox: unknown[];
  lastSyncedAt: string | null;
}

export const migrateV6ToV7 = (value: unknown): ProductivityEnvelopeV7 | null => {
  if (!isRecord(value)) return null;
  const data = normalizeData(value);
  if (!isValidData(data)) return null;
  return {
    schemaVersion: 7,
    data,
    metadata: {},
    outbox: [],
    lastSyncedAt: null,
  };
};

export const migrateV7ToV8 = (value: unknown): ProductivityEnvelopeV8 | null => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 7 ||
    !isValidData(value.data) ||
    (value.metadata !== undefined && !isRecord(value.metadata)) ||
    (value.outbox !== undefined && !Array.isArray(value.outbox))
  )
    return null;
  return {
    schemaVersion: 8,
    data: value.data,
    metadata: isRecord(value.metadata) ? value.metadata : {},
    summaryMeta: null,
    outbox: Array.isArray(value.outbox) ? value.outbox : [],
    lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : null,
  };
};

export const migrateV8ToV9 = (value: unknown): ProductivityEnvelopeV9 | null => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 8 ||
    !isValidData(value.data) ||
    !isRecord(value.metadata) ||
    !Array.isArray(value.outbox)
  )
    return null;
  const outbox = migrateOutbox(value.outbox);
  const summaryValues = isRecord(value.summaryMeta)
    ? Object.values(migrateMetadata({ summary: value.summaryMeta }))
    : [];
  return {
    schemaVersion: 9,
    data: value.data,
    metadata: migrateMetadata(value.metadata),
    summaryMeta: summaryValues[0] ?? null,
    outbox,
    pullState: { ...emptyPullState(), needsRebase: outbox.length > 0 },
    lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : null,
  };
};

export const migrateToLatest = (
  value: unknown,
  sourceVersion: 6 | 7 | 8 | 9,
): ProductivityEnvelopeV9 | null => {
  if (sourceVersion === 9) {
    return typeof value === 'string' ? parseV9(value) : parseV9(JSON.stringify(value));
  }
  const v7 = sourceVersion === 6 ? migrateV6ToV7(value) : value;
  if (!v7) return null;
  const v8 = sourceVersion <= 7 ? migrateV7ToV8(v7) : v7;
  if (!v8) return null;
  return migrateV8ToV9(v8);
};

const parseAndMigrate = (raw: string, sourceVersion: 6 | 7 | 8): ProductivityEnvelopeV9 | null => {
  try {
    return migrateToLatest(JSON.parse(raw) as unknown, sourceVersion);
  } catch {
    return null;
  }
};

const migrateLegacy = async (): Promise<ProductivityEnvelopeV9> => {
  const v8 = await AsyncStorage.getItem(LEGACY_PRODUCTIVITY_V8_STORAGE_KEY);
  if (v8) {
    const migrated = parseAndMigrate(v8, 8);
    if (migrated) return migrated;
  }
  const v7 = await AsyncStorage.getItem(LEGACY_PRODUCTIVITY_STORAGE_KEY);
  if (v7) {
    const migrated = parseAndMigrate(v7, 7);
    if (migrated) return migrated;
  }
  const v6 = await AsyncStorage.getItem(HOME_STATE_KEY);
  if (!v6) return emptyEnvelope();
  return parseAndMigrate(v6, 6) ?? emptyEnvelope();
};

export const writeLocalProductivity = async (envelope: ProductivityEnvelopeV9): Promise<void> => {
  await AsyncStorage.setItem(PRODUCTIVITY_STORAGE_KEY, JSON.stringify(envelope));
};

export const loadLocalProductivity = async (): Promise<ProductivityEnvelopeV9> => {
  const current = await AsyncStorage.getItem(PRODUCTIVITY_STORAGE_KEY);
  if (current) {
    const parsed = parseV9(current);
    if (parsed) return parsed;
    await AsyncStorage.removeItem(PRODUCTIVITY_STORAGE_KEY);
  }
  const migrated = await migrateLegacy();
  await writeLocalProductivity(migrated);
  return migrated;
};

const existingMutation = (outbox: SyncMutation[], type: SyncEntityType, id: string) =>
  outbox.find((item) => item.entityType === type && item.entityId === id);

const nextMetadata = (
  previous: SyncMetadata | undefined,
  fingerprint: string,
  deviceId: string,
  deletedAt?: string,
): SyncMetadata => ({
  schemaVersion: 2,
  serverRevision: previous?.serverRevision ?? 0,
  localRevision: (previous?.localRevision ?? 0) + 1,
  updatedAt: new Date().toISOString(),
  deviceId,
  fingerprint,
  ...(deletedAt ? { deletedAt } : {}),
});

const replaceMutation = (outbox: SyncMutation[], mutation: SyncMutation): void => {
  const remaining = outbox.filter(
    (item) => item.entityType !== mutation.entityType || item.entityId !== mutation.entityId,
  );
  outbox.splice(0, outbox.length, ...remaining, mutation);
};

const queueMutation = (
  type: SyncEntityType,
  id: string,
  operation: 'upsert' | 'delete',
  payload: SyncMutation['payload'],
  meta: SyncMetadata,
  outbox: SyncMutation[],
): void => {
  const pending = existingMutation(outbox, type, id);
  replaceMutation(outbox, {
    mutationId: Crypto.randomUUID(),
    entityType: type,
    entityId: id,
    operation,
    payload,
    baseServerRevision: pending?.baseServerRevision ?? meta.serverRevision,
    deviceId: meta.deviceId,
    clientUpdatedAt: meta.updatedAt,
    fingerprint: meta.fingerprint,
  });
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
  queueMutation(type, id, 'upsert', value, meta, outbox);
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
    queueMutation(type, id, 'delete', null, meta, outbox);
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
  queueMutation('summary', SUMMARY_ID, 'upsert', summary, meta, outbox);
  return meta;
};

export const persistLocalProductivity = async (
  data: ProductivityData,
): Promise<ProductivityEnvelopeV9> => {
  const current = await loadLocalProductivity();
  const deviceId = await getDeviceId();
  const metadata = { ...current.metadata };
  const outbox = [...current.outbox];
  for (const goal of data.goals) queueEntity('goal', goal.id, goal, metadata, outbox, deviceId);
  for (const habit of data.habits)
    queueEntity('habit', habit.id, habit, metadata, outbox, deviceId);
  for (const snapshot of data.weeklyHistory)
    queueEntity('snapshot', snapshot.date, snapshot, metadata, outbox, deviceId);
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
  const envelope = { ...current, data, metadata, summaryMeta, outbox };
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
  let next = {
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

export const replaceLocalProductivity = async (
  data: ProductivityData,
  metadata: Record<string, SyncMetadata> = {},
  summaryMeta: SyncMetadata | null = null,
  pullState: PullStateV9 = emptyPullState(),
): Promise<void> => {
  await writeLocalProductivity({
    schemaVersion: 9,
    data,
    metadata,
    summaryMeta,
    outbox: [],
    pullState,
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
    LEGACY_PRODUCTIVITY_V8_STORAGE_KEY,
    LEGACY_PRODUCTIVITY_STORAGE_KEY,
    HOME_STATE_KEY,
  ]);
};
