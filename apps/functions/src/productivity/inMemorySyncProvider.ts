import type {
  CloudChange,
  CloudMetadataV2,
  ProductivityEntityType,
  SerializedTimestamp,
  SummaryChange,
  SyncMutationV9,
} from './types';
import type { ChangeQuery, SyncProvider } from './provider';
import { decideMutation } from './syncPolicy';

interface UserState {
  epoch: number;
  entities: Map<string, CloudChange>;
  summary: SummaryChange | null;
}

const RETENTION_SECONDS = 90 * 24 * 60 * 60;

const compareTimestamp = (a: SerializedTimestamp, b: SerializedTimestamp): number =>
  a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;

const keyOf = (type: ProductivityEntityType, id: string): string => `${type}:${id}`;

export class InMemorySyncProvider implements SyncProvider {
  private readonly users = new Map<string, UserState>();
  private instant: SerializedTimestamp;

  constructor(initialTime: SerializedTimestamp = { seconds: 1, nanoseconds: 0 }) {
    this.instant = initialTime;
  }

  now(): SerializedTimestamp {
    return { ...this.instant };
  }

  advance(seconds = 1): void {
    this.instant = {
      seconds: this.instant.seconds + seconds,
      nanoseconds: this.instant.nanoseconds,
    };
  }

  private user(uid: string): UserState {
    const current = this.users.get(uid);
    if (current) return current;
    const created: UserState = { epoch: 0, entities: new Map(), summary: null };
    this.users.set(uid, created);
    return created;
  }

  async readSyncEpoch(uid: string): Promise<number> {
    return this.user(uid).epoch;
  }

  async readSummary(uid: string): Promise<SummaryChange | null> {
    return this.user(uid).summary;
  }

  async compactExpiredTombstones(
    uid: string,
    now: SerializedTimestamp,
  ): Promise<{ compacted: number; epoch: number }> {
    const user = this.user(uid);
    let compacted = 0;
    for (const [key, change] of user.entities) {
      if (change.meta.purgeAfter && compareTimestamp(change.meta.purgeAfter, now) <= 0) {
        user.entities.delete(key);
        compacted += 1;
      }
    }
    if (compacted > 0) user.epoch += 1;
    return { compacted, epoch: user.epoch };
  }

  async applyMutationBatch(uid: string, mutations: SyncMutationV9[], now: SerializedTimestamp) {
    const user = this.user(uid);
    return mutations.map((mutation) => {
      const current =
        mutation.entityType === 'summary'
          ? user.summary
          : (user.entities.get(keyOf(mutation.entityType, mutation.entityId)) ?? null);
      const decision = decideMutation(mutation, {
        exists: current !== null,
        revision: current?.meta.serverRevision ?? 0,
        lastMutationId: current?.meta.lastMutationId,
        authoritative: current,
      });
      if (!decision.apply) return decision.outcome;
      if (mutation.entityType === 'summary') {
        if (!mutation.payload || !('totalXp' in mutation.payload)) return decision.outcome;
        user.summary = { data: mutation.payload, meta: decision.nextMeta, serverUpdatedAt: now };
        return decision.outcome;
      }
      const meta: CloudMetadataV2 =
        mutation.operation === 'delete'
          ? {
              ...decision.nextMeta,
              deletedAt: now,
              purgeAfter: {
                seconds: now.seconds + RETENTION_SECONDS,
                nanoseconds: now.nanoseconds,
              },
            }
          : decision.nextMeta;
      user.entities.set(keyOf(mutation.entityType, mutation.entityId), {
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        data: mutation.operation === 'delete' ? null : mutation.payload,
        meta,
        serverUpdatedAt: now,
      } as CloudChange);
      return decision.outcome;
    });
  }

  async readChanges({ entityType, cursor, upperBound, continuing, mode, uid }: ChangeQuery) {
    const values = [...this.user(uid).entities.values()]
      .filter((change) => change.entityType === entityType)
      .filter((change) => compareTimestamp(change.serverUpdatedAt, upperBound) <= 0)
      .filter((change) => {
        if (!cursor) return true;
        const timestamp = compareTimestamp(change.serverUpdatedAt, cursor);
        if (mode === 'incremental' && !continuing) return timestamp >= 0;
        return timestamp > 0 || (timestamp === 0 && change.entityId > cursor.documentId);
      })
      .sort(
        (a, b) =>
          compareTimestamp(a.serverUpdatedAt, b.serverUpdatedAt) ||
          a.entityId.localeCompare(b.entityId),
      );
    const page = values.slice(0, 100);
    const last = page[page.length - 1];
    return {
      changes: page,
      cursor: last ? { ...last.serverUpdatedAt, documentId: last.entityId } : cursor,
      hasMore: values.length > 100,
    };
  }
}
