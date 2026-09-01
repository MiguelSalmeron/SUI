const test = require('node:test');
const assert = require('node:assert/strict');
const { InMemorySyncProvider } = require('../lib/productivity/inMemorySyncProvider.js');
const {
  applyMutationBatch,
  compactExpiredTombstones,
  synchronizeProductivityV9,
} = require('../lib/productivity/syncEngine.js');

const uid = 'memory-owner';
const mutation = (overrides = {}) => ({
  mutationId: 'mutation-a',
  entityType: 'habit',
  entityId: 'habit-1',
  operation: 'upsert',
  payload: {
    id: 'habit-1',
    title: 'Habit',
    completed: false,
    frequency: 'daily',
    streak: 0,
    createdAt: '2026-08-30',
  },
  baseServerRevision: 0,
  deviceId: 'device-a',
  clientUpdatedAt: '2026-08-30T00:00:00.000Z',
  fingerprint: 'a',
  ...overrides,
});

test('in-memory provider covers CAS, replay and stale without emulator', async () => {
  const provider = new InMemorySyncProvider();
  const first = await applyMutationBatch(uid, [mutation()], provider.now(), provider);
  const replay = await applyMutationBatch(uid, [mutation()], provider.now(), provider);
  const stale = await applyMutationBatch(
    uid,
    [mutation({ mutationId: 'mutation-b', fingerprint: 'b' })],
    provider.now(),
    provider,
  );

  assert.equal(first[0].status, 'applied');
  assert.equal(replay[0].status, 'replayed');
  assert.equal(stale[0].status, 'rejected');
  assert.equal(stale[0].authoritative.data.title, 'Habit');
});

test('sync engine accepts injected provider and pulls committed data', async () => {
  const provider = new InMemorySyncProvider();
  const response = await synchronizeProductivityV9(
    uid,
    {
      schemaVersion: 9,
      deviceId: 'device-a',
      mutations: [mutation()],
      pull: {
        mode: 'incremental',
        syncEpoch: 0,
        cursors: { goals: null, habits: null, snapshots: null },
        upperBound: null,
      },
    },
    provider,
  );

  assert.equal(response.outcomes[0].status, 'applied');
  assert.deepEqual(
    response.changes.map((change) => change.entityId),
    ['habit-1'],
  );
});

test('in-memory tombstone compaction increments epoch', async () => {
  const provider = new InMemorySyncProvider({ seconds: 1, nanoseconds: 0 });
  await applyMutationBatch(uid, [mutation()], provider.now(), provider);
  provider.advance();
  await applyMutationBatch(
    uid,
    [mutation({ mutationId: 'delete', operation: 'delete', payload: null, baseServerRevision: 1 })],
    provider.now(),
    provider,
  );
  provider.advance(90 * 24 * 60 * 60);

  assert.deepEqual(await compactExpiredTombstones(uid, provider.now(), provider), {
    compacted: 1,
    epoch: 1,
  });
});
