import type { PullCursors, SyncMutationV9, SyncRequestV9, TimestampCursor } from './types';

const ENTITY_TYPES = new Set(['goal', 'habit', 'snapshot', 'summary']);
const OPERATIONS = new Set(['upsert', 'delete']);
const MAX_MUTATIONS = 50;
const MAX_REQUEST_BYTES = 256_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const nonEmptyString = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

const documentId = (value: unknown): value is string =>
  nonEmptyString(value, 240) && value !== '.' && value !== '..' && !value.includes('/');

const nonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const onlyKeys = (value: Record<string, unknown>, allowed: string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));

const optionalString = (value: unknown, max = 64): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.length <= max);

const validGoal = (value: Record<string, unknown>, entityId: string): boolean =>
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
  ]) &&
  value.id === entityId &&
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
  ['low', 'high'].includes(String(value.gravity)) &&
  nonEmptyString(value.createdAt, 64);

const DAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

const validHabit = (value: Record<string, unknown>, entityId: string): boolean =>
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
  ]) &&
  value.id === entityId &&
  nonEmptyString(value.title, 240) &&
  typeof value.completed === 'boolean' &&
  (value.frequency === 'daily' ||
    (Array.isArray(value.frequency) && value.frequency.every((day) => DAYS.has(String(day))))) &&
  nonNegativeInteger(value.streak) &&
  optionalString(value.lastCompletedDate) &&
  optionalString(value.frozenUntil) &&
  optionalString(value.linkedGoalId, 240) &&
  nonEmptyString(value.createdAt, 64);

const validSnapshot = (value: Record<string, unknown>, entityId: string): boolean =>
  onlyKeys(value, ['date', 'goalsCompleted', 'goalsTotal', 'habitsCompleted', 'habitsTotal']) &&
  value.date === entityId &&
  nonNegativeInteger(value.goalsCompleted) &&
  nonNegativeInteger(value.goalsTotal) &&
  nonNegativeInteger(value.habitsCompleted) &&
  nonNegativeInteger(value.habitsTotal);

const validSummary = (value: Record<string, unknown>): boolean =>
  onlyKeys(value, ['lastResetDate', 'streakCount', 'lastCompletedDate', 'totalXp']) &&
  optionalString(value.lastResetDate) &&
  nonNegativeInteger(value.streakCount) &&
  optionalString(value.lastCompletedDate) &&
  nonNegativeInteger(value.totalXp);

const validCursor = (value: unknown): value is TimestampCursor | null => {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return (
    nonNegativeInteger(value.seconds) &&
    nonNegativeInteger(value.nanoseconds) &&
    value.nanoseconds < 1_000_000_000 &&
    typeof value.documentId === 'string' &&
    value.documentId.length <= 240
  );
};

const validCursors = (value: unknown): value is PullCursors => {
  if (!isRecord(value)) return false;
  return validCursor(value.goals) && validCursor(value.habits) && validCursor(value.snapshots);
};

const validPayload = (mutation: SyncMutationV9): boolean => {
  if (mutation.operation === 'delete') {
    return mutation.entityType !== 'summary' && mutation.payload === null;
  }
  if (!isRecord(mutation.payload)) return false;
  if (mutation.entityType === 'summary') {
    return mutation.entityId === 'singleton' && validSummary(mutation.payload);
  }
  if (mutation.entityType === 'goal') return validGoal(mutation.payload, mutation.entityId);
  if (mutation.entityType === 'habit') return validHabit(mutation.payload, mutation.entityId);
  return validSnapshot(mutation.payload, mutation.entityId);
};

const parseMutation = (value: unknown): SyncMutationV9 | null => {
  if (!isRecord(value)) return null;
  if (
    !nonEmptyString(value.mutationId, 128) ||
    !ENTITY_TYPES.has(String(value.entityType)) ||
    !documentId(value.entityId) ||
    !OPERATIONS.has(String(value.operation)) ||
    !nonNegativeInteger(value.baseServerRevision) ||
    !nonEmptyString(value.deviceId, 128) ||
    !nonEmptyString(value.clientUpdatedAt, 64) ||
    !nonEmptyString(value.fingerprint, 200_000)
  ) {
    return null;
  }
  const mutation = value as unknown as SyncMutationV9;
  return validPayload(mutation) ? mutation : null;
};

export const parseSyncRequest = (value: unknown): SyncRequestV9 | null => {
  if (!isRecord(value) || JSON.stringify(value).length > MAX_REQUEST_BYTES) return null;
  if (
    value.schemaVersion !== 9 ||
    !nonEmptyString(value.deviceId, 128) ||
    !Array.isArray(value.mutations) ||
    value.mutations.length > MAX_MUTATIONS ||
    !isRecord(value.pull) ||
    !['bootstrap', 'incremental'].includes(String(value.pull.mode)) ||
    !(value.pull.syncEpoch === null || nonNegativeInteger(value.pull.syncEpoch)) ||
    !validCursors(value.pull.cursors)
  ) {
    return null;
  }
  const upperBound = value.pull.upperBound;
  if (
    upperBound !== null &&
    (!isRecord(upperBound) ||
      !nonNegativeInteger(upperBound.seconds) ||
      !nonNegativeInteger(upperBound.nanoseconds) ||
      upperBound.nanoseconds >= 1_000_000_000)
  ) {
    return null;
  }
  const mutations = value.mutations.map(parseMutation);
  if (mutations.some((mutation) => mutation === null)) return null;
  const entityKeys = new Set<string>();
  const mutationIds = new Set<string>();
  for (const mutation of mutations as SyncMutationV9[]) {
    if (mutation.deviceId !== value.deviceId) return null;
    const key = `${mutation.entityType}:${mutation.entityId}`;
    if (entityKeys.has(key) || mutationIds.has(mutation.mutationId)) return null;
    entityKeys.add(key);
    mutationIds.add(mutation.mutationId);
  }
  return value as unknown as SyncRequestV9;
};
