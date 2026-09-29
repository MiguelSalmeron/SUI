/**
 * Guards runtime compartidos por los parsers del paquete.
 *
 * Módulo interno: sólo `isPlannedTime` forma parte de la API pública. Se
 * importa desde `sync`, `billing` y `widgets` para que todos los parsers
 * validen con las mismas reglas.
 */

import type {
  DailySnapshot,
  DayOfWeek,
  Goal,
  Habit,
  ProductivitySummary,
  UserPreferences,
} from './productivity';
import type {
  MutationOperation,
  PullCursors,
  SerializedTimestamp,
  SyncEntityType,
  SyncMutationV9,
  TimestampCursor,
} from './sync';

const ENTITY_TYPES = new Set<SyncEntityType>(['goal', 'habit', 'snapshot', 'summary']);
const OPERATIONS = new Set<MutationOperation>(['upsert', 'delete']);
const DAYS = new Set<DayOfWeek>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const nonEmptyString = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

export const nonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const onlyKeys = (value: Record<string, unknown>, allowed: string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));

const optionalString = (value: unknown, max = 64): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.length <= max);

export const isPlannedTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const documentId = (value: unknown): value is string =>
  nonEmptyString(value, 240) && value !== '.' && value !== '..' && !value.includes('/');

export const isTimestamp = (value: unknown): value is SerializedTimestamp =>
  isRecord(value) &&
  nonNegativeInteger(value.seconds) &&
  nonNegativeInteger(value.nanoseconds) &&
  value.nanoseconds < 1_000_000_000;

const isCursor = (value: unknown): value is TimestampCursor | null =>
  value === null || (isTimestamp(value) && isRecord(value) && typeof value.documentId === 'string');

export const isCursors = (value: unknown): value is PullCursors =>
  isRecord(value) && isCursor(value.goals) && isCursor(value.habits) && isCursor(value.snapshots);

export const isGoal = (value: unknown, entityId?: string): value is Goal =>
  isRecord(value) &&
  onlyKeys(value, [
    'id',
    'title',
    'deadline',
    'progress',
    'milestones',
    'impactDays',
    'completed',
    'gravity',
    'createdAt',
    'mirrorToGoogle',
  ]) &&
  (!entityId || value.id === entityId) &&
  nonEmptyString(value.id, 240) &&
  nonEmptyString(value.title, 240) &&
  nonEmptyString(value.deadline, 64) &&
  nonNegativeInteger(value.progress) &&
  value.progress <= 100 &&
  Array.isArray(value.milestones) &&
  value.milestones.length <= 500 &&
  value.milestones.every(
    (item) =>
      isRecord(item) &&
      onlyKeys(item, ['id', 'title', 'completed']) &&
      nonEmptyString(item.id, 240) &&
      nonEmptyString(item.title, 240) &&
      typeof item.completed === 'boolean',
  ) &&
  (value.impactDays === undefined ||
    (Array.isArray(value.impactDays) &&
      value.impactDays.length <= 366 &&
      value.impactDays.every((item) => nonEmptyString(item, 64)))) &&
  typeof value.completed === 'boolean' &&
  (value.gravity === 'low' || value.gravity === 'high') &&
  nonEmptyString(value.createdAt, 64) &&
  (value.mirrorToGoogle === undefined || typeof value.mirrorToGoogle === 'boolean');

export const isHabit = (value: unknown, entityId?: string): value is Habit =>
  isRecord(value) &&
  onlyKeys(value, [
    'id',
    'title',
    'completed',
    'frequency',
    'streak',
    'lastCompletedDate',
    'frozenUntil',
    'linkedGoalId',
    'createdAt',
    'plannedTime',
    'mirrorToGoogle',
  ]) &&
  (!entityId || value.id === entityId) &&
  nonEmptyString(value.id, 240) &&
  nonEmptyString(value.title, 240) &&
  typeof value.completed === 'boolean' &&
  (value.frequency === 'daily' ||
    (Array.isArray(value.frequency) &&
      value.frequency.every((day) => typeof day === 'string' && DAYS.has(day as DayOfWeek)))) &&
  nonNegativeInteger(value.streak) &&
  optionalString(value.lastCompletedDate) &&
  optionalString(value.frozenUntil) &&
  optionalString(value.linkedGoalId, 240) &&
  nonEmptyString(value.createdAt, 64) &&
  (value.plannedTime === undefined || isPlannedTime(value.plannedTime)) &&
  (value.mirrorToGoogle === undefined || typeof value.mirrorToGoogle === 'boolean');

export const isSnapshot = (value: unknown, entityId?: string): value is DailySnapshot =>
  isRecord(value) &&
  onlyKeys(value, ['date', 'goalsCompleted', 'goalsTotal', 'habitsCompleted', 'habitsTotal']) &&
  (!entityId || value.date === entityId) &&
  nonEmptyString(value.date, 64) &&
  nonNegativeInteger(value.goalsCompleted) &&
  nonNegativeInteger(value.goalsTotal) &&
  nonNegativeInteger(value.habitsCompleted) &&
  nonNegativeInteger(value.habitsTotal);

const isPreferencesData = (value: unknown): value is UserPreferences =>
  isRecord(value) &&
  onlyKeys(value, [
    'schemaVersion',
    'theme',
    'fontSize',
    'language',
    'notificationsEnabled',
    'updatedAt',
  ]) &&
  value.schemaVersion === 1 &&
  (value.theme === undefined || ['system', 'light', 'dark'].includes(value.theme as string)) &&
  (value.fontSize === undefined ||
    ['small', 'medium', 'large'].includes(value.fontSize as string)) &&
  (value.language === undefined || ['system', 'es', 'en'].includes(value.language as string)) &&
  (value.notificationsEnabled === undefined || typeof value.notificationsEnabled === 'boolean') &&
  optionalString(value.updatedAt, 64);

export const isSummaryData = (value: unknown): value is ProductivitySummary =>
  isRecord(value) &&
  onlyKeys(value, [
    'lastResetDate',
    'streakCount',
    'lastCompletedDate',
    'totalXp',
    'xpDelta',
    'preferences',
  ]) &&
  optionalString(value.lastResetDate) &&
  nonNegativeInteger(value.streakCount) &&
  optionalString(value.lastCompletedDate) &&
  nonNegativeInteger(value.totalXp) &&
  (value.xpDelta === undefined || Number.isInteger(value.xpDelta)) &&
  (value.preferences === undefined || isPreferencesData(value.preferences));

export const isMutation = (value: unknown, deviceId: string): value is SyncMutationV9 => {
  if (
    !isRecord(value) ||
    !nonEmptyString(value.mutationId, 128) ||
    typeof value.entityType !== 'string' ||
    !ENTITY_TYPES.has(value.entityType as SyncEntityType) ||
    !documentId(value.entityId) ||
    typeof value.operation !== 'string' ||
    !OPERATIONS.has(value.operation as MutationOperation) ||
    !nonNegativeInteger(value.baseServerRevision) ||
    value.deviceId !== deviceId ||
    !nonEmptyString(value.clientUpdatedAt, 64) ||
    !nonEmptyString(value.fingerprint, 200_000)
  )
    return false;
  if (value.operation === 'delete') return value.entityType !== 'summary' && value.payload === null;
  if (value.entityType === 'summary')
    return value.entityId === 'singleton' && isSummaryData(value.payload);
  if (value.entityType === 'goal') return isGoal(value.payload, value.entityId);
  if (value.entityType === 'habit') return isHabit(value.payload, value.entityId);
  return isSnapshot(value.payload, value.entityId);
};
