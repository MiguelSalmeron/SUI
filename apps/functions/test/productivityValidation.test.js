const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSyncRequest } = require('../lib/productivity/validation.js');

const mutation = (id, entityId = id) => ({
  mutationId: id,
  entityType: 'habit',
  entityId,
  operation: 'upsert',
  payload: {
    id: entityId,
    title: 'Habit',
    completed: false,
    frequency: 'daily',
    streak: 0,
    createdAt: '2026-08-30',
  },
  baseServerRevision: 0,
  deviceId: 'device-a',
  clientUpdatedAt: '2026-08-30T00:00:00.000Z',
  fingerprint: id,
});

const request = (mutations) => ({
  schemaVersion: 9,
  deviceId: 'device-a',
  mutations,
  pull: {
    mode: 'incremental',
    syncEpoch: 0,
    cursors: { goals: null, habits: null, snapshots: null },
    upperBound: null,
  },
});

test('accepts valid v9 batch', () => {
  assert.ok(parseSyncRequest(request([mutation('one'), mutation('two')])));
});

test('rejects batch over 50', () => {
  assert.equal(
    parseSyncRequest(request(Array.from({ length: 51 }, (_, index) => mutation(`m-${index}`)))),
    null,
  );
});

test('rejects duplicate entity and mutation ID', () => {
  assert.equal(parseSyncRequest(request([mutation('one', 'same'), mutation('two', 'same')])), null);
  assert.equal(parseSyncRequest(request([mutation('same', 'one'), mutation('same', 'two')])), null);
});

test('rejects device mismatch and malformed cursor', () => {
  assert.equal(parseSyncRequest(request([{ ...mutation('one'), deviceId: 'device-b' }])), null);
  const invalid = request([]);
  invalid.pull.cursors.goals = { seconds: 1, nanoseconds: 1_000_000_000, documentId: 'goal' };
  assert.equal(parseSyncRequest(invalid), null);
});

test('rejects malformed entity and extra payload fields', () => {
  assert.equal(parseSyncRequest(request([{ ...mutation('one'), payload: { id: 'one' } }])), null);
  assert.equal(
    parseSyncRequest(
      request([
        {
          ...mutation('one'),
          payload: { ...mutation('one').payload, unexpected: true },
        },
      ]),
    ),
    null,
  );
});
