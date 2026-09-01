const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSyncRequest, parseSyncResponse } = require('../dist/index.js');

const cursors = { goals: null, habits: null, snapshots: null };

test('shared parser accepts valid request and rejects payload drift', () => {
  const request = {
    schemaVersion: 9,
    deviceId: 'device-a',
    mutations: [],
    pull: { mode: 'incremental', syncEpoch: 0, cursors, upperBound: null },
  };

  assert.deepEqual(parseSyncRequest(request), request);
  assert.equal(parseSyncRequest({ ...request, schemaVersion: 10 }), null);
});

test('shared parser accepts valid response and rejects entity drift', () => {
  const response = {
    schemaVersion: 9,
    resetRequired: false,
    syncEpoch: 0,
    compacted: 0,
    outcomes: [],
    changes: [],
    summary: null,
    cursors,
    upperBound: { seconds: 1, nanoseconds: 0 },
    hasMore: false,
  };

  assert.deepEqual(parseSyncResponse(response), response);
  assert.equal(parseSyncResponse({ ...response, changes: [{ entityType: 'unknown' }] }), null);
});
