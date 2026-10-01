import * as Crypto from 'expo-crypto';
import type { Goal, Habit } from '@/shared/types/models';
import type { DailySnapshot } from '../model/gamification';
import { getDeviceId } from './storageKeys';
import { loadLocalProductivity, writeLocalProductivity } from './localStore';
import {
  fingerprintValue,
  metadataKey,
  productivitySummary,
  upsertById,
} from './envelope';
import type {
  ProductivityData,
  ProductivityEntityType,
  ProductivityEnvelopeV9,
  ProductivitySummary,
  SyncEntityType,
  SyncMetadata,
  SyncMutation,
  UserPreferences,
} from '../sync/syncTypes';

/**
 * Outbox local: convierte cambios del dominio en mutaciones sincronizables.
 *
 * Una mutación por entidad: si la misma entidad cambia dos veces antes de
 * subir, se reemplaza la anterior en vez de acumular. Las bajas se detectan
 * comparando contra la metadata previa, para que borrar también se propague.
 */

const SUMMARY_ID = 'singleton';

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

const isDefaultPreferences = (prefs?: UserPreferences): boolean => {
  if (!prefs) return true;
  return (
    (!prefs.theme || prefs.theme === 'system') &&
    (!prefs.fontSize || prefs.fontSize === 'medium') &&
    (!prefs.language || prefs.language === 'system') &&
    !prefs.notificationsEnabled
  );
};

export const isDefaultSummary = (summary: ProductivitySummary): boolean =>
  summary.streakCount === 0 &&
  summary.totalXp === 0 &&
  !summary.lastCompletedDate &&
  isDefaultPreferences(summary.preferences);

const queueSummary = (
  data: ProductivityData,
  previous: SyncMetadata | null,
  outbox: SyncMutation[],
  deviceId: string,
): SyncMetadata | null => {
  const summary = productivitySummary(data);
  if (!previous && isDefaultSummary(summary)) {
    return null;
  }
  const fingerprint = fingerprintValue(summary);
  if (previous?.fingerprint === fingerprint && !previous.deletedAt) return previous;
  const meta = nextMetadata(previous ?? undefined, fingerprint, deviceId);
  queueMutation('summary', SUMMARY_ID, 'upsert', summary, meta, outbox);
  return meta;
};

/**
 * Persiste el estado completo y devuelve el sobre con el outbox actualizado.
 *
 * Se re-encola todo lo que difiere de la última metadata (incluidas bajas),
 * así que llamarlo de más es seguro: lo idéntico no se reencola.
 */
export const persistLocalProductivity = async (
  data: ProductivityData,
  uid?: string | null,
): Promise<ProductivityEnvelopeV9> => {
  const current = await loadLocalProductivity(uid);
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
  await writeLocalProductivity(envelope, uid);
  return envelope;
};

/**
 * Reaplica el outbox sobre datos que vienen de la nube: lo que aún no subió
 * debe seguir viéndose aunque el pull traiga una versión más vieja.
 */
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
