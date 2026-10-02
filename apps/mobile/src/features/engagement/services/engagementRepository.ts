/**
 * Persistencia local de Engagement.
 *
 * Clave independiente `sui-engagement-v1` con sufijo `:uid` para cuentas
 * autenticadas (misma política que productividad y accountability). Sin
 * outbox ni cloud: este módulo nunca produce escrituras remotas.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateStoredEnvelope } from '@/shared/infrastructure/storage/migrateStoredEnvelope';
import { runStorageTask } from '@/shared/infrastructure/storage/storageTasks';
import {
  EMPTY_ENGAGEMENT_ENVELOPE,
  ENGAGEMENT_SCHEMA_VERSION,
  ENGAGEMENT_STORAGE_KEY,
  MAX_ENGAGEMENT_FACTS,
  MAX_ENGAGEMENT_SLOTS,
  type EngagementEnvelopeV1,
} from '../model/engagementTypes';
import { parseEngagementEnvelopeV1 } from '../model/engagementValidation';

export const getEngagementStorageKey = (uid?: string | null): string => {
  const normalized = uid?.trim();
  return normalized ? `${ENGAGEMENT_STORAGE_KEY}:${normalized}` : ENGAGEMENT_STORAGE_KEY;
};

export const emptyEngagementEnvelope = (): EngagementEnvelopeV1 =>
  EMPTY_ENGAGEMENT_ENVELOPE(new Date(0).toISOString());

/**
 * Carga el sobre del espacio indicado. Ante corrupción descarta la clave y
 * reconstruye desde vacío: un fallo de engagement no rompe la app.
 */
export const loadEngagement = async (uid?: string | null): Promise<EngagementEnvelopeV1> => {
  const key = getEngagementStorageKey(uid);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return emptyEngagementEnvelope();
  const parsed = parseEngagementEnvelopeV1(raw);
  if (parsed) return parsed;
  await AsyncStorage.removeItem(key);
  return emptyEngagementEnvelope();
};

export const writeEngagement = async (
  envelope: EngagementEnvelopeV1,
  uid?: string | null,
): Promise<void> => {
  const key = getEngagementStorageKey(uid);
  await runStorageTask([key], () => AsyncStorage.setItem(key, JSON.stringify(envelope)));
};

export const clearEngagement = async (uid?: string | null): Promise<void> => {
  const key = getEngagementStorageKey(uid);
  await runStorageTask([key], () => AsyncStorage.removeItem(key));
};

/**
 * Retención defensiva: recorta franjas y hechos a los topes. Se conservan las
 * franjas más recientes y los hechos que cuelgan de franjas vivas.
 */
export const enforceEngagementRetention = (
  envelope: EngagementEnvelopeV1,
): EngagementEnvelopeV1 => {
  const slots = [...envelope.slots]
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey) || b.startMinute - a.startMinute)
    .slice(0, MAX_ENGAGEMENT_SLOTS);
  const slotIds = new Set(slots.map((slot) => slot.id));
  const facts = envelope.facts
    .filter((fact) => slotIds.has(fact.slotId))
    .slice(0, MAX_ENGAGEMENT_FACTS);
  return {
    ...envelope,
    schemaVersion: ENGAGEMENT_SCHEMA_VERSION,
    slots,
    facts,
  };
};

/**
 * Fusiona el espacio de invitado en el de la cuenta (login/registro).
 * Complemento por ID: ante colisión gana el estado de la cuenta. Idempotente.
 */
export const migrateEngagementGuestToUser = async (
  uid: string,
  guestUid?: string | null,
): Promise<void> => {
  if (!uid?.trim()) return;
  const userKey = getEngagementStorageKey(uid);
  const guestKey = guestUid?.trim() ? getEngagementStorageKey(guestUid) : ENGAGEMENT_STORAGE_KEY;
  if (guestKey === userKey) return;

  await migrateStoredEnvelope({
    sourceKey: guestKey,
    targetKey: userKey,
    parse: parseEngagementEnvelopeV1,
    merge: (guest, user) => {
      const slots = new Map(user.slots.map((item) => [item.id, item]));
      for (const item of guest.slots) if (!slots.has(item.id)) slots.set(item.id, item);
      const facts = new Map(user.facts.map((item) => [item.id, item]));
      for (const item of guest.facts) if (!facts.has(item.id)) facts.set(item.id, item);
      return enforceEngagementRetention({
        schemaVersion: ENGAGEMENT_SCHEMA_VERSION,
        profile: user.profile,
        slots: [...slots.values()],
        facts: [...facts.values()],
        updatedAt: new Date().toISOString(),
      });
    },
  });
};
