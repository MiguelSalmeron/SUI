export const SYNC_SCHEMA_VERSION = 9 as const;
export const MAX_SYNC_MUTATIONS = 50;
export const MAX_SYNC_REQUEST_BYTES = 256_000;

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export type GoalGravity = 'low' | 'high';

export interface Goal {
  id: string;
  title: string;
  deadline: string;
  progress: number;
  milestones: Milestone[];
  impactDays?: string[];
  completed: boolean;
  gravity: GoalGravity;
  createdAt: string;
}

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Habit {
  id: string;
  title: string;
  completed: boolean;
  frequency: 'daily' | DayOfWeek[];
  streak: number;
  lastCompletedDate?: string;
  frozenUntil?: string;
  linkedGoalId?: string | null;
  createdAt: string;
}

export interface DailySnapshot {
  date: string;
  goalsCompleted: number;
  goalsTotal: number;
  habitsCompleted: number;
  habitsTotal: number;
}

export type ProductivityEntityType = 'goal' | 'habit' | 'snapshot';
export type SyncEntityType = ProductivityEntityType | 'summary';
export type MutationOperation = 'upsert' | 'delete';

export interface SerializedTimestamp {
  seconds: number;
  nanoseconds: number;
}

export interface TimestampCursor extends SerializedTimestamp {
  documentId: string;
}

export interface PullCursors {
  goals: TimestampCursor | null;
  habits: TimestampCursor | null;
  snapshots: TimestampCursor | null;
}

export interface ProductivitySummary {
  lastResetDate?: string;
  streakCount: number;
  lastCompletedDate?: string;
  totalXp: number;
}

export type SyncPayload = Goal | Habit | DailySnapshot | ProductivitySummary | null;

export interface SyncMutationV9 {
  mutationId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: MutationOperation;
  payload: SyncPayload;
  baseServerRevision: number;
  deviceId: string;
  clientUpdatedAt: string;
  fingerprint: string;
}

export interface SyncRequestV9 {
  schemaVersion: typeof SYNC_SCHEMA_VERSION;
  deviceId: string;
  mutations: SyncMutationV9[];
  pull: {
    mode: 'bootstrap' | 'incremental';
    syncEpoch: number | null;
    cursors: PullCursors;
    upperBound: SerializedTimestamp | null;
  };
}

export interface CloudMetadataV2 {
  schemaVersion: 2;
  serverRevision: number;
  originDeviceId: string;
  clientUpdatedAt: string;
  fingerprint: string;
  lastMutationId: string;
  deletedAt?: SerializedTimestamp;
  purgeAfter?: SerializedTimestamp;
}

export interface CloudChange {
  entityType: ProductivityEntityType;
  entityId: string;
  data: Goal | Habit | DailySnapshot | null;
  meta: CloudMetadataV2;
  serverUpdatedAt: SerializedTimestamp;
}

export interface SummaryChange {
  data: ProductivitySummary;
  meta: CloudMetadataV2;
  serverUpdatedAt: SerializedTimestamp;
}

export interface MutationOutcomeV9 {
  mutationId: string;
  status: 'applied' | 'replayed' | 'rejected';
  serverRevision: number;
  reason?: 'stale' | 'missing';
  authoritative?: CloudChange | SummaryChange | null;
}

export interface SyncResponseV9 {
  schemaVersion: typeof SYNC_SCHEMA_VERSION;
  resetRequired: boolean;
  syncEpoch: number;
  compacted: number;
  outcomes: MutationOutcomeV9[];
  changes: CloudChange[];
  summary: SummaryChange | null;
  cursors: PullCursors;
  upperBound: SerializedTimestamp;
  hasMore: boolean;
}

const ENTITY_TYPES = new Set<SyncEntityType>(['goal', 'habit', 'snapshot', 'summary']);
const OPERATIONS = new Set<MutationOperation>(['upsert', 'delete']);
const DAYS = new Set<DayOfWeek>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const nonEmptyString = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

const nonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const onlyKeys = (value: Record<string, unknown>, allowed: string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));

const optionalString = (value: unknown, max = 64): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.length <= max);

const documentId = (value: unknown): value is string =>
  nonEmptyString(value, 240) && value !== '.' && value !== '..' && !value.includes('/');

const isTimestamp = (value: unknown): value is SerializedTimestamp =>
  isRecord(value) &&
  nonNegativeInteger(value.seconds) &&
  nonNegativeInteger(value.nanoseconds) &&
  value.nanoseconds < 1_000_000_000;

const isCursor = (value: unknown): value is TimestampCursor | null =>
  value === null || (isTimestamp(value) && isRecord(value) && typeof value.documentId === 'string');

const isCursors = (value: unknown): value is PullCursors =>
  isRecord(value) && isCursor(value.goals) && isCursor(value.habits) && isCursor(value.snapshots);

const isGoal = (value: unknown, entityId?: string): value is Goal =>
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
  nonEmptyString(value.createdAt, 64);

const isHabit = (value: unknown, entityId?: string): value is Habit =>
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
  nonEmptyString(value.createdAt, 64);

const isSnapshot = (value: unknown, entityId?: string): value is DailySnapshot =>
  isRecord(value) &&
  onlyKeys(value, ['date', 'goalsCompleted', 'goalsTotal', 'habitsCompleted', 'habitsTotal']) &&
  (!entityId || value.date === entityId) &&
  nonEmptyString(value.date, 64) &&
  nonNegativeInteger(value.goalsCompleted) &&
  nonNegativeInteger(value.goalsTotal) &&
  nonNegativeInteger(value.habitsCompleted) &&
  nonNegativeInteger(value.habitsTotal);

const isSummaryData = (value: unknown): value is ProductivitySummary =>
  isRecord(value) &&
  onlyKeys(value, ['lastResetDate', 'streakCount', 'lastCompletedDate', 'totalXp']) &&
  optionalString(value.lastResetDate) &&
  nonNegativeInteger(value.streakCount) &&
  optionalString(value.lastCompletedDate) &&
  nonNegativeInteger(value.totalXp);

const isMutation = (value: unknown, deviceId: string): value is SyncMutationV9 => {
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

export const parseSyncRequest = (value: unknown): SyncRequestV9 | null => {
  if (!isRecord(value) || JSON.stringify(value).length > MAX_SYNC_REQUEST_BYTES) return null;
  if (
    value.schemaVersion !== SYNC_SCHEMA_VERSION ||
    !nonEmptyString(value.deviceId, 128) ||
    !Array.isArray(value.mutations) ||
    value.mutations.length > MAX_SYNC_MUTATIONS ||
    !isRecord(value.pull) ||
    (value.pull.mode !== 'bootstrap' && value.pull.mode !== 'incremental') ||
    !(value.pull.syncEpoch === null || nonNegativeInteger(value.pull.syncEpoch)) ||
    !isCursors(value.pull.cursors) ||
    !(value.pull.upperBound === null || isTimestamp(value.pull.upperBound))
  )
    return null;
  if (!value.mutations.every((mutation) => isMutation(mutation, value.deviceId as string)))
    return null;
  const entityKeys = new Set<string>();
  const mutationIds = new Set<string>();
  for (const mutation of value.mutations as SyncMutationV9[]) {
    const key = `${mutation.entityType}:${mutation.entityId}`;
    if (entityKeys.has(key) || mutationIds.has(mutation.mutationId)) return null;
    entityKeys.add(key);
    mutationIds.add(mutation.mutationId);
  }
  return value as unknown as SyncRequestV9;
};

const isMetadata = (value: unknown): value is CloudMetadataV2 =>
  isRecord(value) &&
  value.schemaVersion === 2 &&
  nonNegativeInteger(value.serverRevision) &&
  typeof value.originDeviceId === 'string' &&
  typeof value.clientUpdatedAt === 'string' &&
  typeof value.fingerprint === 'string' &&
  typeof value.lastMutationId === 'string' &&
  (value.deletedAt === undefined || isTimestamp(value.deletedAt)) &&
  (value.purgeAfter === undefined || isTimestamp(value.purgeAfter));

const isChange = (value: unknown): value is CloudChange => {
  if (
    !isRecord(value) ||
    !['goal', 'habit', 'snapshot'].includes(String(value.entityType)) ||
    typeof value.entityId !== 'string' ||
    !isMetadata(value.meta) ||
    !isTimestamp(value.serverUpdatedAt)
  )
    return false;
  if (value.data === null) return true;
  if (value.entityType === 'goal') return isGoal(value.data, value.entityId);
  if (value.entityType === 'habit') return isHabit(value.data, value.entityId);
  return isSnapshot(value.data, value.entityId);
};

const isSummaryChange = (value: unknown): value is SummaryChange =>
  isRecord(value) &&
  isSummaryData(value.data) &&
  isMetadata(value.meta) &&
  isTimestamp(value.serverUpdatedAt);

const isOutcome = (value: unknown): value is MutationOutcomeV9 =>
  isRecord(value) &&
  typeof value.mutationId === 'string' &&
  ['applied', 'replayed', 'rejected'].includes(String(value.status)) &&
  nonNegativeInteger(value.serverRevision) &&
  (value.reason === undefined || value.reason === 'stale' || value.reason === 'missing') &&
  (value.authoritative === undefined ||
    value.authoritative === null ||
    isChange(value.authoritative) ||
    isSummaryChange(value.authoritative));

export const parseSyncResponse = (value: unknown): SyncResponseV9 | null => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== SYNC_SCHEMA_VERSION ||
    typeof value.resetRequired !== 'boolean' ||
    !nonNegativeInteger(value.syncEpoch) ||
    !nonNegativeInteger(value.compacted) ||
    !Array.isArray(value.outcomes) ||
    !value.outcomes.every(isOutcome) ||
    !Array.isArray(value.changes) ||
    !value.changes.every(isChange) ||
    !(value.summary === null || isSummaryChange(value.summary)) ||
    !isCursors(value.cursors) ||
    !isTimestamp(value.upperBound) ||
    typeof value.hasMore !== 'boolean'
  )
    return null;
  return value as unknown as SyncResponseV9;
};
