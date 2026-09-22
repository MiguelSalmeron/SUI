/**
 * Validadores estrictos del contrato de Accountability (Fase 1).
 *
 * Parsers tolerantes estilo productividad v9: ante cualquier dato inválido o
 * corrupto se devuelve `null` y el repositorio decide el fallback (estado
 * vacío), sin romper la app ni la productividad (plan §12, persistencia MVP).
 */

import {
  ACCOUNTABILITY_SCHEMA_VERSION,
  MAX_ACTION_TEXT_LENGTH,
  MAX_COMMITMENTS,
  MAX_CYCLES_PER_COMMITMENT,
  MAX_FACTS,
  MAX_NOTE_LENGTH,
  type AccountabilityCommitment,
  type AccountabilityDay,
  type AccountabilityEnvelopeV1,
  type AccountabilityIntensity,
  type AccountabilityPersonality,
  type AccountabilityProfile,
  type CycleStatus,
  type EscalationPolicy,
  type FollowUpCycle,
  type FollowUpFact,
  type QuietHours,
  type ScheduleRule,
} from './accountabilityTypes';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const nonEmptyString = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

const boundedInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

const isoDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const hhmm = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const isoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 64 &&
  !Number.isNaN(Date.parse(value));

const DAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const INTENSITIES: AccountabilityIntensity[] = ['soft', 'firm', 'demanding', 'custom'];
const PERSONALITIES: AccountabilityPersonality[] = [
  'coach',
  'direct',
  'partner',
  'mentor',
  'minimal',
];
const ESCALATIONS: EscalationPolicy[] = ['reschedule_or_minimum', 'minimum_only', 'notify_once'];
const CYCLE_STATUSES: CycleStatus[] = [
  'configured',
  'scheduled',
  'due',
  'acknowledged',
  'in_progress',
  'completed',
  'overdue',
  'unknown',
  'rescheduled',
  'reduced',
  'paused',
  'abandoned',
];
const RESOLUTIONS = [
  'completed',
  'continued',
  'reduced',
  'rescheduled',
  'paused',
  'abandoned',
] as const;
const FACT_KINDS = [
  'scheduled',
  'opened',
  'check_in',
  'snoozed',
  'completed',
  'rescheduled',
  'paused',
] as const;
const FACT_SOURCES = ['app', 'notification', 'system_reconcile'] as const;

const isDay = (value: unknown): value is AccountabilityDay =>
  typeof value === 'string' && DAYS.has(value);

const onlyKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));

const isQuietHours = (value: unknown): value is QuietHours =>
  isRecord(value) &&
  onlyKeys(value, ['startMinute', 'endMinute']) &&
  boundedInt(value.startMinute, 0, 1439) &&
  boundedInt(value.endMinute, 0, 1439);

const isScheduleRule = (value: unknown): value is ScheduleRule => {
  if (!isRecord(value)) return false;
  if (value.kind === 'once') {
    return onlyKeys(value, ['kind', 'date', 'time']) && isoDate(value.date) && hhmm(value.time);
  }
  if (value.kind === 'daily') {
    return onlyKeys(value, ['kind', 'time']) && hhmm(value.time);
  }
  if (value.kind === 'weekly') {
    return (
      onlyKeys(value, ['kind', 'days', 'time']) &&
      Array.isArray(value.days) &&
      value.days.length > 0 &&
      value.days.length <= 7 &&
      value.days.every(isDay) &&
      hhmm(value.time)
    );
  }
  return false;
};

/** Hora HH:MM válida (misma regla del contrato). */
export const isValidTime = (value: unknown): value is string => hhmm(value);

/** Texto libre visible; vacío sólo si el campo es obligatorio se valida aparte. */
export const validateUserText = (value: unknown, max = MAX_ACTION_TEXT_LENGTH): boolean =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

/** Nota breve local (Fase 3); admite vacío explícito. */
export const validateNote = (value: unknown): boolean =>
  typeof value === 'string' && value.length <= MAX_NOTE_LENGTH;

type StoredProfile = Omit<AccountabilityProfile, 'weeklyDigestEnabled'> & {
  weeklyDigestEnabled?: boolean;
};

const isProfile = (value: unknown): value is StoredProfile =>
  isRecord(value) &&
  onlyKeys(value, [
    'enabled',
    'defaultIntensity',
    'personality',
    'maxNotificationsPerDay',
    'quietHours',
    'restDays',
    'allowEscalation',
    'allowNotificationActions',
    'weeklyDigestEnabled',
    'updatedAt',
  ]) &&
  typeof value.enabled === 'boolean' &&
  INTENSITIES.includes(value.defaultIntensity as AccountabilityIntensity) &&
  PERSONALITIES.includes(value.personality as AccountabilityPersonality) &&
  boundedInt(value.maxNotificationsPerDay, 1, 12) &&
  isQuietHours(value.quietHours) &&
  Array.isArray(value.restDays) &&
  value.restDays.length <= 7 &&
  value.restDays.every(isDay) &&
  typeof value.allowEscalation === 'boolean' &&
  typeof value.allowNotificationActions === 'boolean' &&
  (value.weeklyDigestEnabled === undefined || typeof value.weeklyDigestEnabled === 'boolean') &&
  isoTimestamp(value.updatedAt);

/**
 * Los IDs derivados componen el ID del sujeto (hasta 240): compromiso ≤ 251,
 * ciclo ≤ 262, hecho ≤ ~300. El tope 400 los admite sin abrir la puerta a
 * datos sin límite.
 */
const DERIVED_ID_MAX = 400;

const isCommitment = (value: unknown): value is AccountabilityCommitment =>
  isRecord(value) &&
  onlyKeys(value, [
    'id',
    'subjectType',
    'subjectId',
    'enabled',
    'intensity',
    'nextAction',
    'minimumAction',
    'durationMinutes',
    'schedule',
    'escalation',
    'createdAt',
    'updatedAt',
  ]) &&
  nonEmptyString(value.id, DERIVED_ID_MAX) &&
  (value.subjectType === 'goal' || value.subjectType === 'habit') &&
  nonEmptyString(value.subjectId, 240) &&
  typeof value.enabled === 'boolean' &&
  INTENSITIES.includes(value.intensity as AccountabilityIntensity) &&
  validateUserText(value.nextAction) &&
  (value.minimumAction === undefined ||
    (typeof value.minimumAction === 'string' &&
      value.minimumAction.length <= MAX_ACTION_TEXT_LENGTH)) &&
  (value.durationMinutes === undefined || boundedInt(value.durationMinutes, 1, 720)) &&
  isScheduleRule(value.schedule) &&
  ESCALATIONS.includes(value.escalation as EscalationPolicy) &&
  isoTimestamp(value.createdAt) &&
  isoTimestamp(value.updatedAt);

const isCycle = (value: unknown): value is FollowUpCycle =>
  isRecord(value) &&
  onlyKeys(value, [
    'id',
    'commitmentId',
    'localDate',
    'time',
    'status',
    'attemptCount',
    'completedAt',
    'resolvedAt',
    'resolution',
  ]) &&
  nonEmptyString(value.id, DERIVED_ID_MAX) &&
  nonEmptyString(value.commitmentId, DERIVED_ID_MAX) &&
  isoDate(value.localDate) &&
  hhmm(value.time) &&
  CYCLE_STATUSES.includes(value.status as CycleStatus) &&
  boundedInt(value.attemptCount, 0, 10) &&
  (value.completedAt === undefined || isoTimestamp(value.completedAt)) &&
  (value.resolvedAt === undefined || isoTimestamp(value.resolvedAt)) &&
  (value.resolution === undefined ||
    (typeof value.resolution === 'string' &&
      (RESOLUTIONS as readonly string[]).includes(value.resolution)));

const isFact = (value: unknown): value is FollowUpFact =>
  isRecord(value) &&
  onlyKeys(value, ['id', 'cycleId', 'kind', 'occurredAt', 'source', 'value']) &&
  nonEmptyString(value.id, DERIVED_ID_MAX) &&
  nonEmptyString(value.cycleId, DERIVED_ID_MAX) &&
  (FACT_KINDS as readonly string[]).includes(value.kind as string) &&
  isoTimestamp(value.occurredAt) &&
  (FACT_SOURCES as readonly string[]).includes(value.source as string) &&
  (value.value === undefined || (typeof value.value === 'string' && value.value.length <= 64));

/**
 * Parse estricto del sobre v1. Devuelve `null` ante corrupción: el caller
 * decide si reconstruye desde vacío (nunca lanza).
 */
export const parseAccountabilityEnvelopeV1 = (raw: unknown): AccountabilityEnvelopeV1 | null => {
  const value = typeof raw === 'string' ? safeJson(raw) : raw;
  if (
    !isRecord(value) ||
    value.schemaVersion !== ACCOUNTABILITY_SCHEMA_VERSION ||
    !isProfile(value.profile) ||
    !Array.isArray(value.commitments) ||
    value.commitments.length > MAX_COMMITMENTS ||
    !value.commitments.every(isCommitment) ||
    !Array.isArray(value.cycles) ||
    !value.cycles.every(isCycle) ||
    !Array.isArray(value.facts) ||
    value.facts.length > MAX_FACTS ||
    !value.facts.every(isFact) ||
    !isoTimestamp(value.updatedAt)
  )
    return null;
  const commitmentIds = new Set(value.commitments.map((item) => item.id));
  if (commitmentIds.size !== value.commitments.length) return null;
  const cyclesByCommitment = new Map<string, number>();
  for (const cycle of value.cycles) {
    if (!commitmentIds.has(cycle.commitmentId)) return null;
    cyclesByCommitment.set(
      cycle.commitmentId,
      (cyclesByCommitment.get(cycle.commitmentId) ?? 0) + 1,
    );
  }
  for (const count of cyclesByCommitment.values()) {
    if (count > MAX_CYCLES_PER_COMMITMENT) return null;
  }
  const cycleIds = new Set(value.cycles.map((item) => item.id));
  if (cycleIds.size !== value.cycles.length) return null;
  if (value.facts.some((fact) => !cycleIds.has(fact.cycleId))) return null;
  return {
    schemaVersion: ACCOUNTABILITY_SCHEMA_VERSION,
    profile: {
      ...value.profile,
      weeklyDigestEnabled: value.profile.weeklyDigestEnabled ?? true,
    },
    commitments: value.commitments,
    cycles: value.cycles,
    facts: value.facts,
    updatedAt: value.updatedAt,
  };
};

const safeJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
