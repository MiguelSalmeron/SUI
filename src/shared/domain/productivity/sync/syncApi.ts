import { auth, getAppCheckToken } from '@/shared/infrastructure/firebase/firebase';
import type { SyncRequestV9, SyncResponseV9 } from './syncTypes';

const API_BASE = process.env.EXPO_PUBLIC_SYNC_API_URL?.trim().replace(/\/$/, '') ?? '';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isTimestamp = (value: unknown): boolean =>
  isRecord(value) &&
  Number.isInteger(value.seconds) &&
  Number.isInteger(value.nanoseconds) &&
  Number(value.nanoseconds) >= 0 &&
  Number(value.nanoseconds) < 1_000_000_000;

const isCursor = (value: unknown): boolean =>
  value === null || (isTimestamp(value) && isRecord(value) && typeof value.documentId === 'string');

const isMetadata = (value: unknown): boolean =>
  isRecord(value) &&
  value.schemaVersion === 2 &&
  Number.isInteger(value.serverRevision) &&
  Number(value.serverRevision) >= 0 &&
  typeof value.originDeviceId === 'string' &&
  typeof value.clientUpdatedAt === 'string' &&
  typeof value.fingerprint === 'string' &&
  typeof value.lastMutationId === 'string' &&
  (value.deletedAt === undefined || isTimestamp(value.deletedAt)) &&
  (value.purgeAfter === undefined || isTimestamp(value.purgeAfter));

const isChange = (value: unknown): boolean =>
  isRecord(value) &&
  ['goal', 'habit', 'snapshot'].includes(String(value.entityType)) &&
  typeof value.entityId === 'string' &&
  (value.data === null || isRecord(value.data)) &&
  isMetadata(value.meta) &&
  isTimestamp(value.serverUpdatedAt);

const isSummary = (value: unknown): boolean =>
  value === null ||
  (isRecord(value) &&
    isRecord(value.data) &&
    isMetadata(value.meta) &&
    isTimestamp(value.serverUpdatedAt));

const isOutcome = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.mutationId === 'string' &&
  ['applied', 'replayed', 'rejected'].includes(String(value.status)) &&
  Number.isInteger(value.serverRevision) &&
  Number(value.serverRevision) >= 0 &&
  (value.authoritative === undefined ||
    value.authoritative === null ||
    isChange(value.authoritative) ||
    isSummary(value.authoritative));

const isSyncResponse = (value: unknown): value is SyncResponseV9 => {
  const response = value as Partial<SyncResponseV9> | null;
  return Boolean(
    response &&
    response.schemaVersion === 9 &&
    typeof response.resetRequired === 'boolean' &&
    Number.isInteger(response.syncEpoch) &&
    Number(response.syncEpoch) >= 0 &&
    Number.isInteger(response.compacted) &&
    Number(response.compacted) >= 0 &&
    Array.isArray(response.outcomes) &&
    response.outcomes.every(isOutcome) &&
    Array.isArray(response.changes) &&
    response.changes.every(isChange) &&
    isSummary(response.summary) &&
    isRecord(response.cursors) &&
    isCursor(response.cursors.goals) &&
    isCursor(response.cursors.habits) &&
    isCursor(response.cursors.snapshots) &&
    isTimestamp(response.upperBound) &&
    typeof response.hasMore === 'boolean',
  );
};

export const requestProductivitySync = async (request: SyncRequestV9): Promise<SyncResponseV9> => {
  const user = auth.currentUser;
  if (!user) throw new Error('sync-auth-required');
  if (!API_BASE) throw new Error('sync-api-not-configured');
  const [idToken, appCheckToken] = await Promise.all([user.getIdToken(), getAppCheckToken()]);
  const response = await fetch(`${API_BASE}/syncProductivity`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`sync-http-${response.status}`);
  const body: unknown = await response.json();
  if (!isSyncResponse(body)) throw new Error('sync-invalid-response');
  return body;
};
