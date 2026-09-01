import {
  FieldPath,
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
} from 'firebase-admin/firestore';
import { firestore } from '../chat/firebase';
import type {
  CloudChange,
  CloudMetadataV2,
  CollectionEntityType,
  MutationOutcomeV9,
  ProductivitySummary,
  SerializedTimestamp,
  SummaryChange,
  SyncMutationV9,
  TimestampCursor,
} from './types';
import type { ChangeQuery, SyncProvider } from './provider';
import { decideMutation } from './syncPolicy';

const COLLECTIONS = ['goals', 'habits', 'snapshots'] as const;
const PAGE_SIZE = 100;
const COMPACTION_LIMIT = 100;
const TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

type CollectionName = (typeof COLLECTIONS)[number];

const collectionName = (type: CollectionEntityType): CollectionName => {
  if (type === 'goal') return 'goals';
  if (type === 'habit') return 'habits';
  return 'snapshots';
};

const entityType = (name: CollectionName): CollectionEntityType => {
  if (name === 'goals') return 'goal';
  if (name === 'habits') return 'habit';
  return 'snapshot';
};

const serializeTimestamp = (value: unknown): SerializedTimestamp => {
  const timestamp = value instanceof Timestamp ? value : new Timestamp(0, 0);
  return { seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds };
};

const asTimestamp = (value: unknown): Timestamp | null =>
  value instanceof Timestamp ? value : null;

const serverRevision = (meta: Record<string, unknown> | undefined): number => {
  const value = meta?.serverRevision ?? meta?.revision;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
};

const serializeMetadata = (value: unknown): CloudMetadataV2 => {
  const meta = (value ?? {}) as Record<string, unknown>;
  const deletedAt = asTimestamp(meta.deletedAt);
  const purgeAfter = asTimestamp(meta.purgeAfter);
  return {
    schemaVersion: 2,
    serverRevision: serverRevision(meta),
    originDeviceId:
      typeof meta.originDeviceId === 'string'
        ? meta.originDeviceId
        : typeof meta.deviceId === 'string'
          ? meta.deviceId
          : 'legacy',
    clientUpdatedAt:
      typeof meta.clientUpdatedAt === 'string'
        ? meta.clientUpdatedAt
        : typeof meta.updatedAt === 'string'
          ? meta.updatedAt
          : '',
    fingerprint: typeof meta.fingerprint === 'string' ? meta.fingerprint : 'legacy',
    lastMutationId: typeof meta.lastMutationId === 'string' ? meta.lastMutationId : 'legacy-import',
    ...(deletedAt ? { deletedAt: serializeTimestamp(deletedAt) } : {}),
    ...(purgeAfter ? { purgeAfter: serializeTimestamp(purgeAfter) } : {}),
  };
};

const serializeEntity = (
  type: CollectionEntityType,
  snapshot: DocumentSnapshot,
): CloudChange | null => {
  if (!snapshot.exists) return null;
  const value = snapshot.data() as DocumentData;
  return {
    entityType: type,
    entityId: snapshot.id,
    data: value.data && typeof value.data === 'object' ? value.data : null,
    meta: serializeMetadata(value.meta),
    serverUpdatedAt: serializeTimestamp(value.serverUpdatedAt),
  };
};

const serializeSummary = (root: DocumentSnapshot): SummaryChange | null => {
  const productivity = root.data()?.productivity as Record<string, unknown> | undefined;
  if (!productivity?.meta) return null;
  const lastResetDate = productivity.lastResetDate;
  const lastCompletedDate = productivity.lastCompletedDate;
  return {
    data: {
      streakCount: typeof productivity.streakCount === 'number' ? productivity.streakCount : 0,
      totalXp: typeof productivity.totalXp === 'number' ? productivity.totalXp : 0,
      ...(typeof lastResetDate === 'string' ? { lastResetDate } : {}),
      ...(typeof lastCompletedDate === 'string' ? { lastCompletedDate } : {}),
    },
    meta: serializeMetadata(productivity.meta),
    serverUpdatedAt: serializeTimestamp(productivity.serverUpdatedAt),
  };
};

const syncEpoch = (root: DocumentSnapshot): number => {
  const value = root.data()?.syncControl?.epoch;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
};

const minimumTimestamp = (values: (Timestamp | null)[]): Timestamp | null => {
  const available = values.filter((value): value is Timestamp => value !== null);
  return available.reduce<Timestamp | null>(
    (minimum, value) => (!minimum || value.toMillis() < minimum.toMillis() ? value : minimum),
    null,
  );
};

export const compactExpiredTombstones = async (
  uid: string,
  now: Timestamp = Timestamp.now(),
): Promise<{ compacted: number; epoch: number }> => {
  const rootRef = firestore.collection('users').doc(uid);
  const root = await rootRef.get();
  const nextCompactionAt = asTimestamp(root.data()?.syncControl?.nextCompactionAt);
  if (!nextCompactionAt || nextCompactionAt.toMillis() > now.toMillis()) {
    return { compacted: 0, epoch: syncEpoch(root) };
  }

  const [expiredResults, futureResults] = await Promise.all([
    Promise.all(
      COLLECTIONS.map((name) =>
        rootRef
          .collection(name)
          .where('meta.purgeAfter', '<=', now)
          .orderBy('meta.purgeAfter', 'asc')
          .limit(COMPACTION_LIMIT)
          .get(),
      ),
    ),
    Promise.all(
      COLLECTIONS.map((name) =>
        rootRef
          .collection(name)
          .where('meta.purgeAfter', '>', now)
          .orderBy('meta.purgeAfter', 'asc')
          .limit(1)
          .get(),
      ),
    ),
  ]);
  const candidates = expiredResults.flatMap((result) => result.docs.map((item) => item.ref));
  const moreExpired = expiredResults.some((result) => result.size === COMPACTION_LIMIT);
  const earliestFuture = minimumTimestamp(
    futureResults.map((result) => asTimestamp(result.docs[0]?.data()?.meta?.purgeAfter)),
  );

  return firestore.runTransaction(async (transaction) => {
    const snapshots = candidates.length
      ? await transaction.getAll(rootRef, ...candidates)
      : [await transaction.get(rootRef)];
    const currentRoot = snapshots[0];
    let compacted = 0;
    for (const snapshot of snapshots.slice(1)) {
      const purgeAfter = asTimestamp(snapshot.data()?.meta?.purgeAfter);
      if (!snapshot.exists || !purgeAfter || purgeAfter.toMillis() > now.toMillis()) continue;
      transaction.delete(snapshot.ref);
      compacted += 1;
    }
    const currentEpoch = syncEpoch(currentRoot);
    const concurrentNext = asTimestamp(currentRoot.data()?.syncControl?.nextCompactionAt);
    const next = moreExpired
      ? now
      : minimumTimestamp([
          earliestFuture,
          concurrentNext && concurrentNext.toMillis() > now.toMillis() ? concurrentNext : null,
        ]);
    transaction.set(
      rootRef,
      {
        schemaVersion: 9,
        syncControl: {
          epoch: compacted > 0 ? currentEpoch + 1 : currentEpoch,
          nextCompactionAt: next,
        },
      },
      { merge: true },
    );
    return { compacted, epoch: compacted > 0 ? currentEpoch + 1 : currentEpoch };
  });
};

const mutationReference = (
  rootRef: DocumentReference,
  mutation: SyncMutationV9,
): DocumentReference =>
  mutation.entityType === 'summary'
    ? rootRef
    : rootRef.collection(collectionName(mutation.entityType)).doc(mutation.entityId);

const authoritativeValue = (
  mutation: SyncMutationV9,
  snapshot: DocumentSnapshot,
): CloudChange | SummaryChange | null =>
  mutation.entityType === 'summary'
    ? serializeSummary(snapshot)
    : serializeEntity(mutation.entityType, snapshot);

const currentMetadata = (
  mutation: SyncMutationV9,
  snapshot: DocumentSnapshot,
): Record<string, unknown> | undefined =>
  mutation.entityType === 'summary'
    ? (snapshot.data()?.productivity?.meta as Record<string, unknown> | undefined)
    : (snapshot.data()?.meta as Record<string, unknown> | undefined);

export const applyMutationBatch = async (
  uid: string,
  mutations: SyncMutationV9[],
  now: Timestamp = Timestamp.now(),
): Promise<MutationOutcomeV9[]> => {
  if (mutations.length === 0) return [];
  const rootRef = firestore.collection('users').doc(uid);
  const references = mutations.map((mutation) => mutationReference(rootRef, mutation));
  const uniqueReferences = [...new Map(references.map((ref) => [ref.path, ref])).values()];
  if (!uniqueReferences.some((ref) => ref.path === rootRef.path)) uniqueReferences.unshift(rootRef);

  return firestore.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(...uniqueReferences);
    const byPath = new Map(snapshots.map((snapshot) => [snapshot.ref.path, snapshot]));
    const outcomes: MutationOutcomeV9[] = [];
    let nextCompactionAt = asTimestamp(
      byPath.get(rootRef.path)?.data()?.syncControl?.nextCompactionAt,
    );

    for (let index = 0; index < mutations.length; index += 1) {
      const mutation = mutations[index];
      const ref = references[index];
      const snapshot = byPath.get(ref.path);
      if (!snapshot) throw new Error('sync-reference-missing');
      const meta = currentMetadata(mutation, snapshot);
      const revision = serverRevision(meta);
      const exists = mutation.entityType === 'summary' ? Boolean(meta) : snapshot.exists;
      const decision = decideMutation(mutation, {
        exists,
        revision,
        lastMutationId: typeof meta?.lastMutationId === 'string' ? meta.lastMutationId : undefined,
        authoritative: authoritativeValue(mutation, snapshot),
      });
      outcomes.push(decision.outcome);
      if (!decision.apply) {
        continue;
      }
      const nextMeta: Record<string, unknown> = { ...decision.nextMeta };
      if (mutation.entityType === 'summary') {
        const summary = mutation.payload as ProductivitySummary;
        transaction.set(
          rootRef,
          {
            schemaVersion: 9,
            productivity: {
              lastResetDate: summary.lastResetDate ?? null,
              streakCount: summary.streakCount,
              lastCompletedDate: summary.lastCompletedDate ?? null,
              totalXp: summary.totalXp,
              meta: nextMeta,
              serverUpdatedAt: FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        );
      } else if (mutation.operation === 'delete') {
        const purgeAfter = Timestamp.fromMillis(now.toMillis() + TOMBSTONE_RETENTION_MS);
        nextMeta.deletedAt = now;
        nextMeta.purgeAfter = purgeAfter;
        nextCompactionAt = minimumTimestamp([nextCompactionAt, purgeAfter]);
        transaction.set(ref, {
          data: null,
          meta: nextMeta,
          serverUpdatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.set(ref, {
          data: mutation.payload,
          meta: nextMeta,
          serverUpdatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    if (nextCompactionAt) {
      const root = byPath.get(rootRef.path);
      transaction.set(
        rootRef,
        {
          schemaVersion: 9,
          syncControl: {
            epoch: syncEpoch(root ?? snapshots[0]),
            nextCompactionAt,
          },
        },
        { merge: true },
      );
    }
    return outcomes;
  });
};

const cursorTimestamp = (cursor: TimestampCursor): Timestamp =>
  new Timestamp(cursor.seconds, cursor.nanoseconds);

const readCollectionDelta = async (
  rootRef: DocumentReference,
  name: CollectionName,
  mode: 'bootstrap' | 'incremental',
  cursor: TimestampCursor | null,
  upperBound: Timestamp,
  continuing: boolean,
): Promise<{ changes: CloudChange[]; cursor: TimestampCursor | null; hasMore: boolean }> => {
  let query = rootRef
    .collection(name)
    .where('serverUpdatedAt', '<=', upperBound)
    .orderBy('serverUpdatedAt', 'asc')
    .orderBy(FieldPath.documentId(), 'asc');
  if (mode === 'incremental' && cursor) {
    query =
      continuing && cursor.documentId
        ? query.startAfter(cursorTimestamp(cursor), cursor.documentId)
        : query.startAt(cursorTimestamp(cursor));
  } else if (mode === 'bootstrap' && cursor) {
    query = query.startAfter(cursorTimestamp(cursor), cursor.documentId);
  }
  const snapshot = await query.limit(PAGE_SIZE + 1).get();
  const page = snapshot.docs.slice(0, PAGE_SIZE);
  const changes = page
    .map((item) => serializeEntity(entityType(name), item))
    .filter((item): item is CloudChange => item !== null);
  const last = page[page.length - 1];
  const updatedAt = last ? asTimestamp(last.data().serverUpdatedAt) : null;
  return {
    changes,
    cursor:
      last && updatedAt
        ? {
            ...serializeTimestamp(updatedAt),
            documentId: last.id,
          }
        : cursor,
    hasMore: snapshot.size > PAGE_SIZE,
  };
};

const toTimestamp = (value: SerializedTimestamp): Timestamp =>
  new Timestamp(value.seconds, value.nanoseconds);

const readChanges = ({
  uid,
  entityType: type,
  mode,
  cursor,
  upperBound,
  continuing,
}: ChangeQuery) =>
  readCollectionDelta(
    firestore.collection('users').doc(uid),
    collectionName(type),
    mode,
    cursor,
    toTimestamp(upperBound),
    continuing,
  );

export const firestoreSyncProvider: SyncProvider = {
  now: () => serializeTimestamp(Timestamp.now()),
  compactExpiredTombstones: (uid, now) => compactExpiredTombstones(uid, toTimestamp(now)),
  applyMutationBatch: (uid, mutations, now) => applyMutationBatch(uid, mutations, toTimestamp(now)),
  readSyncEpoch: async (uid) => {
    const root = await firestore.collection('users').doc(uid).get();
    return syncEpoch(root);
  },
  readSummary: async (uid) => {
    const root = await firestore.collection('users').doc(uid).get();
    return serializeSummary(root);
  },
  readChanges,
};
