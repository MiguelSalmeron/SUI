const test = require('node:test');
const assert = require('node:assert/strict');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  test('productivity sync emulator requires Firestore Emulator', { skip: true }, () => {});
} else {
  const { Timestamp } = require('firebase-admin/firestore');
  const { firestore } = require('../lib/chat/firebase.js');
  const {
    applyMutationBatch,
    compactExpiredTombstones,
    synchronizeProductivityV9,
  } = require('../lib/productivity/syncEngine.js');

  const uid = 'sync-owner';
  const root = () => firestore.collection('users').doc(uid);
  const mutation = (overrides = {}) => ({
    mutationId: 'mutation-a',
    entityType: 'habit',
    entityId: 'habit-1',
    operation: 'upsert',
    payload: {
      id: 'habit-1',
      title: 'A',
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

  test.beforeEach(async () => {
    await firestore.recursiveDelete(root());
  });

  test.after(async () => {
    await firestore.terminate();
  });

  test('first server commit wins; stale loses; duplicate replays', async () => {
    const first = mutation();
    const second = mutation({
      mutationId: 'mutation-b',
      deviceId: 'device-b',
      fingerprint: 'b',
      payload: { ...first.payload, title: 'B' },
    });
    assert.equal((await applyMutationBatch(uid, [first]))[0].status, 'applied');
    const stale = (await applyMutationBatch(uid, [second]))[0];
    assert.equal(stale.status, 'rejected');
    assert.equal(stale.serverRevision, 1);
    assert.equal(stale.authoritative.data.title, 'A');
    const replay = (await applyMutationBatch(uid, [first]))[0];
    assert.equal(replay.status, 'replayed');
    assert.equal(replay.serverRevision, 1);

    const update = mutation({
      mutationId: 'mutation-c',
      baseServerRevision: 1,
      fingerprint: 'c',
      payload: { ...first.payload, title: 'C' },
    });
    assert.equal((await applyMutationBatch(uid, [update]))[0].status, 'applied');
    const oldReplay = (await applyMutationBatch(uid, [first]))[0];
    assert.equal(oldReplay.status, 'rejected');
    assert.equal(oldReplay.serverRevision, 2);
  });

  test('batch commits distinct entities and increments revisions', async () => {
    const results = await applyMutationBatch(uid, [
      mutation(),
      mutation({
        mutationId: 'goal-mutation',
        entityType: 'goal',
        entityId: 'goal-1',
        payload: {
          id: 'goal-1',
          title: 'Goal',
          deadline: '2026-09-01',
          progress: 0,
          milestones: [],
          impactDays: [],
          completed: false,
          gravity: 'low',
          createdAt: '2026-08-30',
        },
        fingerprint: 'goal',
      }),
    ]);
    assert.deepEqual(
      results.map((item) => item.status),
      ['applied', 'applied'],
    );
    assert.deepEqual(
      results.map((item) => item.serverRevision),
      [1, 1],
    );
  });

  test('delete and update obey same CAS policy', async () => {
    await applyMutationBatch(uid, [mutation()]);
    const deletion = mutation({
      mutationId: 'delete',
      operation: 'delete',
      payload: null,
      baseServerRevision: 1,
      fingerprint: 'deleted',
    });
    assert.equal((await applyMutationBatch(uid, [deletion]))[0].status, 'applied');
    const staleUpdate = mutation({ mutationId: 'late-update', baseServerRevision: 1 });
    const result = (await applyMutationBatch(uid, [staleUpdate]))[0];
    assert.equal(result.status, 'rejected');
    assert.equal(result.serverRevision, 2);
    assert.equal(result.authoritative.data, null);
  });

  test('summary merges additively on revision mismatch and preserves XP and streak', async () => {
    // Initial summary: streak = 3, totalXp = 100
    const summaryInitial = mutation({
      mutationId: 'summary-init',
      entityType: 'summary',
      entityId: 'singleton',
      payload: { streakCount: 3, totalXp: 100 },
      fingerprint: 'summary-init',
    });
    const first = (await applyMutationBatch(uid, [summaryInitial]))[0];
    assert.equal(first.serverRevision, 1);

    // Evento A: +10 XP (baseServerRevision: 1)
    const eventA = mutation({
      mutationId: 'event-a',
      entityType: 'summary',
      entityId: 'singleton',
      deviceId: 'device-a',
      baseServerRevision: 1,
      payload: { streakCount: 3, totalXp: 110, xpDelta: 10 },
      fingerprint: 'event-a',
    });
    const resultA = (await applyMutationBatch(uid, [eventA]))[0];
    assert.equal(resultA.status, 'applied');
    assert.equal(resultA.serverRevision, 2);

    // Evento B: +5 XP (concurrente, baseServerRevision: 1 - desfasado respecto al server)
    const eventB = mutation({
      mutationId: 'event-b',
      entityType: 'summary',
      entityId: 'singleton',
      deviceId: 'device-b',
      baseServerRevision: 1,
      payload: { streakCount: 4, totalXp: 105, xpDelta: 5 },
      fingerprint: 'event-b',
    });
    const resultB = (await applyMutationBatch(uid, [eventB]))[0];
    assert.equal(resultB.status, 'applied');
    assert.equal(resultB.serverRevision, 3);

    // Verificar en Firestore que el totalXp materializado es 115 y streak es 4
    let snapshot = await root().get();
    let data = snapshot.data()?.productivity;
    assert.equal(data.totalXp, 115);
    assert.equal(data.streakCount, 4);

    // Evento C: +10 XP
    const eventC = mutation({
      mutationId: 'event-c',
      entityType: 'summary',
      entityId: 'singleton',
      deviceId: 'device-a',
      baseServerRevision: 3,
      payload: { streakCount: 4, totalXp: 125, xpDelta: 10 },
      fingerprint: 'event-c',
    });
    const resultC = (await applyMutationBatch(uid, [eventC]))[0];
    assert.equal(resultC.status, 'applied');
    assert.equal(resultC.serverRevision, 4);

    snapshot = await root().get();
    data = snapshot.data()?.productivity;
    assert.equal(data.totalXp, 125);

    // Reintento de Evento C con mismo mutationId (respuesta previa perdida)
    const replayC = (await applyMutationBatch(uid, [eventC]))[0];
    assert.equal(replayC.status, 'replayed');
    assert.equal(replayC.serverRevision, 4);

    // El total NO debe incrementarse nuevamente
    snapshot = await root().get();
    data = snapshot.data()?.productivity;
    assert.equal(data.totalXp, 125);
  });

  test('incremental pull preserves documents with equal timestamps', async () => {
    const updatedAt = Timestamp.fromMillis(1_000);
    const meta = {
      schemaVersion: 2,
      serverRevision: 1,
      originDeviceId: 'seed',
      clientUpdatedAt: '2026-08-30T00:00:00.000Z',
      fingerprint: 'seed',
      lastMutationId: 'seed',
    };
    await Promise.all(
      ['a', 'b'].map((id) =>
        root().collection('habits').doc(id).set({ data: { id }, meta, serverUpdatedAt: updatedAt }),
      ),
    );
    const response = await synchronizeProductivityV9(uid, {
      schemaVersion: 9,
      deviceId: 'device-a',
      mutations: [],
      pull: {
        mode: 'incremental',
        syncEpoch: 0,
        cursors: {
          goals: null,
          habits: { seconds: 1, nanoseconds: 0, documentId: '' },
          snapshots: null,
        },
        upperBound: null,
      },
    });
    assert.deepEqual(
      response.changes.map((item) => item.entityId),
      ['a', 'b'],
    );
  });

  test('expired tombstone compacts and increments epoch', async () => {
    const past = Timestamp.fromMillis(1_000);
    await root().set({ schemaVersion: 9, syncControl: { epoch: 2, nextCompactionAt: past } });
    await root()
      .collection('habits')
      .doc('deleted')
      .set({
        data: null,
        meta: {
          schemaVersion: 2,
          serverRevision: 2,
          originDeviceId: 'seed',
          clientUpdatedAt: '',
          fingerprint: 'deleted',
          lastMutationId: 'delete',
          deletedAt: past,
          purgeAfter: past,
        },
        serverUpdatedAt: past,
      });
    const result = await compactExpiredTombstones(uid, Timestamp.fromMillis(2_000));
    assert.deepEqual(result, { compacted: 1, epoch: 3 });
    assert.equal((await root().collection('habits').doc('deleted').get()).exists, false);
  });

  test('epoch mismatch blocks push and requires bootstrap', async () => {
    await root().set({ schemaVersion: 9, syncControl: { epoch: 3, nextCompactionAt: null } });
    const response = await synchronizeProductivityV9(uid, {
      schemaVersion: 9,
      deviceId: 'device-a',
      mutations: [mutation()],
      pull: {
        mode: 'incremental',
        syncEpoch: 2,
        cursors: { goals: null, habits: null, snapshots: null },
        upperBound: null,
      },
    });
    assert.equal(response.resetRequired, true);
    assert.equal(response.outcomes.length, 0);
    assert.equal((await root().collection('habits').doc('habit-1').get()).exists, false);
  });

  test('cold bootstrap pull retrieves cloud data without destructive empty summary write', async () => {
    // Populate server with existing cloud data
    const summary = mutation({
      mutationId: 'server-summary',
      entityType: 'summary',
      entityId: 'singleton',
      payload: { streakCount: 5, totalXp: 200 },
      fingerprint: 'server-summary',
    });
    await applyMutationBatch(uid, [summary, mutation({ mutationId: 'server-habit' })]);

    // Clean client performs cold bootstrap (mode: 'bootstrap', empty mutations)
    const response = await synchronizeProductivityV9(uid, {
      schemaVersion: 9,
      deviceId: 'clean-device',
      mutations: [],
      pull: {
        mode: 'bootstrap',
        syncEpoch: 0,
        cursors: { goals: null, habits: null, snapshots: null },
        upperBound: null,
      },
    });

    assert.equal(response.resetRequired, false);
    assert.equal(response.summary?.data.totalXp, 200);
    assert.equal(response.summary?.data.streakCount, 5);
    assert.equal(response.changes.length, 1);
    assert.equal(response.changes[0].entityId, 'habit-1');

    // Server data remains intact
    const serverDoc = await root().get();
    assert.equal(serverDoc.data()?.productivity?.totalXp, 200);
    assert.equal(serverDoc.data()?.productivity?.streakCount, 5);
  });
}
