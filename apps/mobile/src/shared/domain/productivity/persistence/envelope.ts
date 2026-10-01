import AsyncStorage from '@react-native-async-storage/async-storage';
import { HOME_STATE_KEY } from '../model/homeStorage';
import {
  LEGACY_PRODUCTIVITY_STORAGE_KEY,
  LEGACY_PRODUCTIVITY_V8_STORAGE_KEY,
} from './storageKeys';
import type {
  ProductivityData,
  ProductivityEntityType,
  ProductivityEnvelopeV9,
  ProductivitySummary,
  PullStateV9,
  SerializedTimestamp,
  SyncEntityType,
  SyncMetadata,
  SyncMutation,
} from '../sync/syncTypes';

/**
 * Esquema del sobre local v9: validación, migraciones desde versiones viejas y
 * helpers puros sobre los datos.
 *
 * Todo lo que entra desde disco se valida antes de confiar en él: un sobre
 * corrupto se descarta (devuelve `null`) en vez de romper la hidratación.
 */

export const hasMeaningfulProductivityData = (data: Partial<ProductivityData>): boolean => {
  const hasGoals = Array.isArray(data.goals) && data.goals.length > 0;
  const hasHabits = Array.isArray(data.habits) && data.habits.length > 0;
  const hasSnapshots =
    Array.isArray(data.weeklyHistory) &&
    data.weeklyHistory.some(
      (s) =>
        s &&
        ((typeof s.goalsCompleted === 'number' && s.goalsCompleted > 0) ||
          (typeof s.goalsTotal === 'number' && s.goalsTotal > 0) ||
          (typeof s.habitsCompleted === 'number' && s.habitsCompleted > 0) ||
          (typeof s.habitsTotal === 'number' && s.habitsTotal > 0)),
    );
  const hasStreak = typeof data.streakCount === 'number' && data.streakCount > 0;
  const hasXp = typeof data.totalXp === 'number' && data.totalXp > 0;
  return hasGoals || hasHabits || hasSnapshots || hasStreak || hasXp;
};

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
  ...(data.preferences ? { preferences: data.preferences } : {}),
});

/** Reemplaza por id dejando el valor nuevo al frente; lo comparten outbox y nube. */
export const upsertById = <T extends { id: string }>(items: T[], value: T): T[] => [
  value,
  ...items.filter((item) => item.id !== value.id),
];

/**
 * Combina local y nube entidad por entidad dando prioridad a lo local.
 *
 * Se usa en el merge tras registro: el invitado acaba de escribir en el
 * dispositivo, así que su versión gana; en contadores se toma el máximo para
 * no perder progreso de ninguno de los dos lados.
 */
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
    preferences: local.preferences ?? cloud.preferences,
  };
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

export const parseProductivityEnvelopeV9 = (raw: unknown): ProductivityEnvelopeV9 | null => {
  try {
    const value = (
      typeof raw === 'string' ? JSON.parse(raw) : raw
    ) as Partial<ProductivityEnvelopeV9>;
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
    return parseProductivityEnvelopeV9(value);
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

/**
 * Busca datos en las claves de versiones anteriores (v8, v7 y la clave base
 * del home) y los sube al esquema actual. Si no hay nada, estrena sobre vacío.
 */
export const migrateLegacy = async (): Promise<ProductivityEnvelopeV9> => {
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
