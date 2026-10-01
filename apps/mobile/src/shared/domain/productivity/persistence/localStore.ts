import AsyncStorage from '@react-native-async-storage/async-storage';
import { runStorageTask } from '@/shared/infrastructure/storage/storageTasks';
import { migrateStoredEnvelope } from '@/shared/infrastructure/storage/migrateStoredEnvelope';
import { HOME_STATE_KEY } from '../model/homeStorage';
import {
  PRODUCTIVITY_STORAGE_KEY,
  LEGACY_PRODUCTIVITY_V8_STORAGE_KEY,
  LEGACY_PRODUCTIVITY_STORAGE_KEY,
  getProductivityStorageKey,
} from './storageKeys';
import {
  combineProductivity,
  emptyPullState,
  migrateLegacy,
  parseProductivityEnvelopeV9,
} from './envelope';
import type {
  ProductivityData,
  ProductivityEnvelopeV9,
  PullStateV9,
  SyncMetadata,
} from '../sync/syncTypes';

const mergeProductivityEnvelopes = (
  guest: ProductivityEnvelopeV9,
  user: ProductivityEnvelopeV9,
): ProductivityEnvelopeV9 => {
  const outbox = new Map(user.outbox.map((mutation) => [mutation.mutationId, mutation]));
  for (const mutation of guest.outbox)
    if (!outbox.has(mutation.mutationId)) outbox.set(mutation.mutationId, mutation);
  return {
    ...user,
    data: combineProductivity(guest.data, user.data),
    metadata: { ...guest.metadata, ...user.metadata },
    summaryMeta: user.summaryMeta ?? guest.summaryMeta,
    outbox: [...outbox.values()],
    pullState: {
      ...user.pullState,
      needsRebase: user.pullState.needsRebase || guest.pullState.needsRebase,
    },
  };
};

/**
 * Capa de almacenamiento: leer, escribir y borrar el sobre de productividad.
 *
 * No valida ni transforma datos más allá del parseo; eso vive en `envelope`.
 */

export const writeLocalProductivity = async (
  envelope: ProductivityEnvelopeV9,
  uid?: string | null,
): Promise<void> => {
  const targetKey = getProductivityStorageKey(uid);
  await runStorageTask([targetKey], () =>
    AsyncStorage.setItem(targetKey, JSON.stringify(envelope)),
  );
};

export const loadLocalProductivity = async (
  uid?: string | null,
): Promise<ProductivityEnvelopeV9> => {
  const targetKey = getProductivityStorageKey(uid);
  const current = await AsyncStorage.getItem(targetKey);
  if (current) {
    const parsed = parseProductivityEnvelopeV9(current);
    if (parsed) return parsed;
    await AsyncStorage.removeItem(targetKey);
  }
  // Si targetKey es diferente de la clave base y no tiene datos, buscar si hay datos en la clave legacy sin prefijo
  if (targetKey !== PRODUCTIVITY_STORAGE_KEY) {
    const legacy = await AsyncStorage.getItem(PRODUCTIVITY_STORAGE_KEY);
    if (legacy) {
      const parsed = parseProductivityEnvelopeV9(legacy);
      if (parsed) {
        await migrateStoredEnvelope({
          sourceKey: PRODUCTIVITY_STORAGE_KEY,
          targetKey,
          parse: parseProductivityEnvelopeV9,
          merge: mergeProductivityEnvelopes,
        });
        const stored = await AsyncStorage.getItem(targetKey);
        const migrated = stored === null ? null : parseProductivityEnvelopeV9(stored);
        if (!migrated) throw new Error('Migration verification failed');
        return migrated;
      }
    }
  }
  const migrated = await migrateLegacy();
  await writeLocalProductivity(migrated, uid);
  return migrated;
};

/**
 * Escribe el sobre ya resuelto (tras un merge) sin cola de mutaciones: lo que
 * viene de la nube o del resultado combinado ya es la verdad a persistir.
 */
export const replaceLocalProductivity = async (
  data: ProductivityData,
  metadata: Record<string, SyncMetadata> = {},
  summaryMeta: SyncMetadata | null = null,
  pullState: PullStateV9 = emptyPullState(),
  uid?: string | null,
): Promise<void> => {
  await writeLocalProductivity(
    {
      schemaVersion: 9,
      data,
      metadata,
      summaryMeta,
      outbox: [],
      pullState,
      lastSyncedAt: new Date().toISOString(),
    },
    uid,
  );
};

export const clearLocalProductivity = async (uid?: string | null): Promise<void> => {
  if (uid?.trim()) {
    const userKey = getProductivityStorageKey(uid);
    await runStorageTask([userKey], () => AsyncStorage.removeItem(userKey));
    return;
  }
  const keys = [
    PRODUCTIVITY_STORAGE_KEY,
    LEGACY_PRODUCTIVITY_V8_STORAGE_KEY,
    LEGACY_PRODUCTIVITY_STORAGE_KEY,
    HOME_STATE_KEY,
  ];
  await runStorageTask(keys, () => AsyncStorage.multiRemove(keys));
};

/**
 * Traslada los datos del invitado a la cuenta recién creada.
 *
 * Si la cuenta ya tenía datos, combina ambos sobres para no perder nada del
 * invitado; si no, copia tal cual y limpia la clave del invitado.
 */
export const migrateLocalGuestToUser = async (
  uid: string,
  guestUid?: string | null,
): Promise<void> => {
  if (!uid?.trim()) return;
  const userKey = getProductivityStorageKey(uid);
  const guestKey = guestUid?.trim()
    ? getProductivityStorageKey(guestUid)
    : PRODUCTIVITY_STORAGE_KEY;
  if (guestKey === userKey) return;
  const sourceKey =
    (await AsyncStorage.getItem(guestKey)) !== null ? guestKey : PRODUCTIVITY_STORAGE_KEY;
  await migrateStoredEnvelope({
    sourceKey,
    targetKey: userKey,
    parse: parseProductivityEnvelopeV9,
    merge: mergeProductivityEnvelopes,
  });
};
