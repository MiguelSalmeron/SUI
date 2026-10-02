/**
 * Validadores estrictos del contrato de Engagement.
 *
 * Parser tolerante en la línea de productividad v9 y accountability: ante
 * cualquier dato inválido o corrupto devuelve `null` y el repositorio decide
 * reconstruir desde vacío, sin romper la app ni otras features.
 */

import {
  ENGAGEMENT_SCHEMA_VERSION,
  MAX_ENGAGEMENT_FACTS,
  MAX_ENGAGEMENT_SLOTS,
  type EngagementCadence,
  type EngagementEnvelopeV1,
  type EngagementFact,
  type EngagementProfile,
  type EngagementQuietHours,
  type EngagementSlot,
  type EngagementSource,
  type EngagementSlotStatus,
} from './engagementTypes';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const nonEmptyString = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

const boundedInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

const isoDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 64 &&
  !Number.isNaN(Date.parse(value));

const onlyKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));

const DAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const CADENCES: EngagementCadence[] = ['calm', 'steady', 'present', 'demanding'];
const SOURCES: EngagementSource[] = [
  'habit_due',
  'habit_planned',
  'goal_momentum',
  'goal_progress',
  'goal_deadline',
  'streak',
  'inactivity',
  'briefing',
  'midday_focus',
  'afternoon_check',
  'evening_review',
  'reflection',
];
const SLOT_STATUSES: EngagementSlotStatus[] = [
  'planned',
  'delivered',
  'opened',
  'responded',
  'dismissed',
  'skipped',
];
const FACT_KINDS = ['scheduled', 'opened', 'responded', 'dismissed', 'snoozed', 'skipped'] as const;
const FACT_SOURCES = ['app', 'notification', 'system_reconcile'] as const;

const isQuietHours = (value: unknown): value is EngagementQuietHours =>
  isRecord(value) &&
  onlyKeys(value, ['startMinute', 'endMinute']) &&
  boundedInt(value.startMinute, 0, 1439) &&
  boundedInt(value.endMinute, 0, 1439);

const isProfile = (value: unknown): value is EngagementProfile =>
  isRecord(value) &&
  onlyKeys(value, [
    'enabled',
    'adaptive',
    'cadence',
    'maxNotificationsPerDay',
    'quietHours',
    'restDays',
    'fillAmbient',
    'lastAdaptedOn',
    'updatedAt',
  ]) &&
  typeof value.enabled === 'boolean' &&
  typeof value.adaptive === 'boolean' &&
  CADENCES.includes(value.cadence as EngagementCadence) &&
  boundedInt(value.maxNotificationsPerDay, 1, 24) &&
  isQuietHours(value.quietHours) &&
  Array.isArray(value.restDays) &&
  value.restDays.length <= 7 &&
  value.restDays.every((day) => typeof day === 'string' && DAYS.has(day)) &&
  typeof value.fillAmbient === 'boolean' &&
  (value.lastAdaptedOn === undefined || isoDate(value.lastAdaptedOn)) &&
  isoTimestamp(value.updatedAt);

const isSlot = (value: unknown): value is EngagementSlot =>
  isRecord(value) &&
  onlyKeys(value, [
    'id',
    'dayKey',
    'startMinute',
    'status',
    'source',
    'subjectType',
    'subjectId',
  ]) &&
  nonEmptyString(value.id, 64) &&
  isoDate(value.dayKey) &&
  boundedInt(value.startMinute, 0, 1439) &&
  SLOT_STATUSES.includes(value.status as EngagementSlotStatus) &&
  (value.source === undefined || SOURCES.includes(value.source as EngagementSource)) &&
  (value.subjectType === undefined ||
    value.subjectType === 'goal' ||
    value.subjectType === 'habit') &&
  (value.subjectId === undefined || nonEmptyString(value.subjectId, 240));

const isFact = (value: unknown): value is EngagementFact =>
  isRecord(value) &&
  onlyKeys(value, ['id', 'slotId', 'kind', 'occurredAt', 'source']) &&
  nonEmptyString(value.id, 120) &&
  nonEmptyString(value.slotId, 64) &&
  (FACT_KINDS as readonly string[]).includes(value.kind as string) &&
  isoTimestamp(value.occurredAt) &&
  (FACT_SOURCES as readonly string[]).includes(value.source as string);

const safeJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** Parse estricto del sobre v1; `null` ante corrupción (nunca lanza). */
export const parseEngagementEnvelopeV1 = (raw: unknown): EngagementEnvelopeV1 | null => {
  const value = typeof raw === 'string' ? safeJson(raw) : raw;
  if (
    !isRecord(value) ||
    !onlyKeys(value, ['schemaVersion', 'profile', 'slots', 'facts', 'updatedAt']) ||
    value.schemaVersion !== ENGAGEMENT_SCHEMA_VERSION ||
    !isProfile(value.profile) ||
    !Array.isArray(value.slots) ||
    value.slots.length > MAX_ENGAGEMENT_SLOTS ||
    !value.slots.every(isSlot) ||
    !Array.isArray(value.facts) ||
    value.facts.length > MAX_ENGAGEMENT_FACTS ||
    !value.facts.every(isFact) ||
    !isoTimestamp(value.updatedAt)
  )
    return null;

  const slotIds = new Set(value.slots.map((slot) => slot.id));
  if (slotIds.size !== value.slots.length) return null;
  // Todo hecho debe colgar de una franja existente; si no, el sobre está roto.
  if (value.facts.some((fact) => !slotIds.has(fact.slotId))) return null;

  return {
    schemaVersion: ENGAGEMENT_SCHEMA_VERSION,
    profile: value.profile,
    slots: value.slots,
    facts: value.facts,
    updatedAt: value.updatedAt,
  };
};
