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

test('mirror contracts validate fields and rules', () => {
  const {
    isPlannedTime,
    shouldMirrorGoal,
    shouldMirrorHabit,
    parseSyncRequest,
  } = require('../dist/index.js');
  assert.equal(isPlannedTime('07:30'), true);
  assert.equal(isPlannedTime('7:30'), false);
  assert.equal(isPlannedTime('24:00'), false);
  assert.equal(shouldMirrorGoal({ deadline: '2026-09-20' }), true);
  assert.equal(shouldMirrorGoal({ deadline: '2026-09-20', mirrorToGoogle: false }), false);
  assert.equal(
    shouldMirrorHabit(
      { plannedTime: '07:30', mirrorToGoogle: true },
      { goalsEnabled: true, habitsEnabled: true },
    ),
    true,
  );
  assert.equal(shouldMirrorHabit({ plannedTime: '07:30' }), false);
  assert.equal(shouldMirrorHabit({ plannedTime: '7:30', mirrorToGoogle: true }), false);

  const base = {
    schemaVersion: 9,
    deviceId: 'device-a',
    mutations: [],
    pull: {
      mode: 'incremental',
      syncEpoch: 0,
      cursors: { goals: null, habits: null, snapshots: null },
      upperBound: null,
    },
  };
  const withMirror = {
    ...base,
    mutations: [
      {
        mutationId: 'm-1',
        entityType: 'habit',
        entityId: 'habit-1',
        operation: 'upsert',
        payload: {
          id: 'habit-1',
          title: 'Gym',
          completed: false,
          frequency: ['mon'],
          streak: 0,
          createdAt: '2026-09-01',
          plannedTime: '07:30',
          mirrorToGoogle: true,
        },
        baseServerRevision: 0,
        deviceId: 'device-a',
        clientUpdatedAt: '2026-09-08T00:00:00.000Z',
        fingerprint: '{}',
      },
    ],
  };
  assert.ok(parseSyncRequest(withMirror));
  assert.equal(
    parseSyncRequest({
      ...withMirror,
      mutations: [
        {
          ...withMirror.mutations[0],
          payload: { ...withMirror.mutations[0].payload, plannedTime: '7:30' },
        },
      ],
    }),
    null,
  );
});

