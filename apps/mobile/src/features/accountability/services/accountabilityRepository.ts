/**
 * Repositorio local de Accountability (Fase 1) — plan §6.4/§6.5.
 *
 * Clave independiente `sui-accountability-v1` con sufijo `:uid` para cuentas
 * autenticadas (misma política que productividad v9). Sin outbox, sin cloud:
 * este módulo nunca produce escrituras remotas.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateStoredEnvelope } from '@/shared/infrastructure/storage/migrateStoredEnvelope';
import { runStorageTask } from '@/shared/infrastructure/storage/storageTasks';
import {
  ACCOUNTABILITY_SCHEMA_VERSION,
  ACCOUNTABILITY_STORAGE_KEY,
  MAX_CYCLES_PER_COMMITMENT,
  MAX_FACTS,
  type AccountabilityEnvelopeV1,
} from '../model/accountabilityTypes';
import { parseAccountabilityEnvelopeV1 } from '../model/accountabilityValidation';
import { EMPTY_ENVELOPE } from '../model/accountabilityTypes';

export const getAccountabilityStorageKey = (uid?: string | null): string => {
  const normalized = uid?.trim();
  return normalized ? `${ACCOUNTABILITY_STORAGE_KEY}:${normalized}` : ACCOUNTABILITY_STORAGE_KEY;
};

export const emptyAccountabilityEnvelope = (): AccountabilityEnvelopeV1 =>
  EMPTY_ENVELOPE(new Date(0).toISOString());

/**
 * Carga el sobre del espacio indicado. Ante corrupción descarta la clave y
 * reconstruye desde vacío: un fallo de accountability no rompe la app ni
 * toca la productividad (plan §12, persistencia MVP).
 */
export const loadAccountability = async (
  uid?: string | null,
): Promise<AccountabilityEnvelopeV1> => {
  const key = getAccountabilityStorageKey(uid);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return emptyAccountabilityEnvelope();
  const parsed = parseAccountabilityEnvelopeV1(raw);
  if (parsed) return parsed;
  await AsyncStorage.removeItem(key);
  return emptyAccountabilityEnvelope();
};

/** Escribe el sobre completo del espacio indicado. */
export const writeAccountability = async (
  envelope: AccountabilityEnvelopeV1,
  uid?: string | null,
): Promise<void> => {
  const key = getAccountabilityStorageKey(uid);
  await runStorageTask([key], () => AsyncStorage.setItem(key, JSON.stringify(envelope)));
};

/** Elimina por completo el estado local del espacio indicado. */
export const clearAccountability = async (uid?: string | null): Promise<void> => {
  const key = getAccountabilityStorageKey(uid);
  await runStorageTask([key], () => AsyncStorage.removeItem(key));
};

/**
 * Retención defensiva: recorta ciclos y hechos si exceden los topes.
 * Conserva siempre los ciclos más recientes por compromiso (los antiguos son
 * los prescindibles); los hechos cuelgan de ciclos vivos.
 */
export const enforceRetention = (envelope: AccountabilityEnvelopeV1): AccountabilityEnvelopeV1 => {
  const commitments = new Set(envelope.commitments.map((item) => item.id));
  const validCycles = envelope.cycles
    .filter((cycle) => commitments.has(cycle.commitmentId))
    .sort((a, b) => b.localDate.localeCompare(a.localDate) || b.time.localeCompare(a.time));
  const keptPerCommitment = new Map<string, number>();
  const keptCycles = validCycles.filter((cycle) => {
    const count = keptPerCommitment.get(cycle.commitmentId) ?? 0;
    if (count >= MAX_CYCLES_PER_COMMITMENT) return false;
    keptPerCommitment.set(cycle.commitmentId, count + 1);
    return true;
  });
  const cycleIds = new Set(keptCycles.map((cycle) => cycle.id));
  const facts = envelope.facts.filter((fact) => cycleIds.has(fact.cycleId)).slice(0, MAX_FACTS);
  return {
    ...envelope,
    cycles: keptCycles,
    facts,
    schemaVersion: ACCOUNTABILITY_SCHEMA_VERSION,
  };
};

/**
 * Fusiona el espacio de invitado en el de la cuenta (login/registro).
 * Complementos por ID: ante colisión gana el estado existente de la cuenta.
 * Idempotente: reintentos no duplican ni pierden datos.
 */
export const migrateAccountabilityGuestToUser = async (
  uid: string,
  guestUid?: string | null,
): Promise<void> => {
  if (!uid?.trim()) return;
  const userKey = getAccountabilityStorageKey(uid);
  const guestKey = guestUid?.trim()
    ? getAccountabilityStorageKey(guestUid)
    : ACCOUNTABILITY_STORAGE_KEY;
  if (guestKey === userKey) return;

  await migrateStoredEnvelope({
    sourceKey: guestKey,
    targetKey: userKey,
    parse: parseAccountabilityEnvelopeV1,
    merge: (guest, user) => {
      const commitments = new Map(user.commitments.map((item) => [item.id, item]));
      for (const item of guest.commitments)
        if (!commitments.has(item.id)) commitments.set(item.id, item);
      const cycles = new Map(user.cycles.map((item) => [item.id, item]));
      for (const item of guest.cycles) if (!cycles.has(item.id)) cycles.set(item.id, item);
      const facts = new Map(user.facts.map((item) => [item.id, item]));
      for (const item of guest.facts) if (!facts.has(item.id)) facts.set(item.id, item);
      return enforceRetention({
        schemaVersion: ACCOUNTABILITY_SCHEMA_VERSION,
        profile: user.profile,
        commitments: [...commitments.values()],
        cycles: [...cycles.values()],
        facts: [...facts.values()],
        updatedAt: new Date().toISOString(),
      });
    },
  });
};

/**
 * Construye la exportación de datos del usuario (plan §9.7): el estado de
 * accountability se incluye junto al resto de datos locales.
 */
export const exportAccountability = async (
  uid?: string | null,
): Promise<AccountabilityEnvelopeV1> => loadAccountability(uid);
