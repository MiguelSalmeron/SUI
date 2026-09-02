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

test('parseUserEntitlements validates tiers and falls back safely', () => {
  const { parseUserEntitlements, DEFAULT_ENTITLEMENTS } = require('../dist/index.js');
  assert.deepEqual(parseUserEntitlements(null), DEFAULT_ENTITLEMENTS);
  assert.deepEqual(parseUserEntitlements({ tier: 'plus', status: 'active' }), {
    tier: 'plus',
    status: 'active',
    expiresAt: undefined,
    hasUnlimitedAI: true,
    hasMultiDeviceSync: true,
    hasAdvancedCalendar: false,
  });
});

test('parseWidgetSnapshot validates complete structure', () => {
  const { parseWidgetSnapshot } = require('../dist/index.js');
  const valid = {
    date: '2026-09-02',
    streakCount: 5,
    nextActionTitle: 'Meditar 10m',
    pendingHabits: [{ id: 'h-1', title: 'Leer', completed: false }],
    totalXp: 120,
    level: 2,
    lastUpdated: '2026-09-02T10:00:00.000Z',
  };
  assert.deepEqual(parseWidgetSnapshot(valid), valid);
  assert.equal(parseWidgetSnapshot({ ...valid, streakCount: -1 }), null);
  assert.equal(parseWidgetSnapshot({ ...valid, pendingHabits: [{ id: 123 }] }), null);
});

