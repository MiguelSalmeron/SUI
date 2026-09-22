const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toGoogleEventBody,
  buildRecurrence,
  fingerprintMirrorBody,
  canMirrorGoal,
  canMirrorHabit,
} = require('../lib/connections/mirrorMapper.js');

test('goal single deadline maps to all-day event', () => {
  const body = toGoogleEventBody({
    suiType: 'goal',
    suiId: 'goal-1',
    title: 'Entregar portafolio',
    deadline: '2026-09-20',
    completed: false,
    gravity: 'low',
  });
  assert.ok(body);
  assert.equal(body.start.date, '2026-09-20');
  assert.equal(body.end.date, '2026-09-21');
  assert.equal(body.extendedProperties.private.suiId, 'goal-1');
});

test('goal range maps to multi-day exclusive end', () => {
  const body = toGoogleEventBody({
    suiType: 'goal',
    suiId: 'goal-2',
    title: 'Leer 100 páginas',
    deadline: '2026-09-14',
    impactDays: ['2026-09-08', '2026-09-14'],
    completed: false,
    gravity: 'high',
  });
  assert.ok(body);
  assert.equal(body.start.date, '2026-09-08');
  assert.equal(body.end.date, '2026-09-15');
  assert.equal(body.colorId, '11');
});

test('completed goal prefixes check', () => {
  const body = toGoogleEventBody({
    suiType: 'goal',
    suiId: 'goal-3',
    title: 'MVP',
    deadline: '2026-09-20',
    completed: true,
    gravity: 'low',
  });
  assert.ok(body?.summary.startsWith('✓ '));
});

test('habit checklist returns null', () => {
  assert.equal(
    toGoogleEventBody({
      suiType: 'habit',
      suiId: 'habit-1',
      title: 'Agua',
      frequency: 'daily',
      completed: false,
    }),
    null,
  );
});

test('habit with time maps to recurring timed event', () => {
  const body = toGoogleEventBody(
    {
      suiType: 'habit',
      suiId: 'habit-2',
      title: 'Gym',
      frequency: ['mon', 'wed', 'fri'],
      plannedTime: '07:30',
      mirrorToGoogle: true,
      completed: false,
    },
    { startDate: '2026-09-08', timeZone: 'America/Mexico_City' },
  );
  assert.ok(body);
  assert.equal(body.start.dateTime, '2026-09-08T07:30:00');
  assert.deepEqual(body.recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR']);
});

test('recurrence builders', () => {
  assert.deepEqual(buildRecurrence('daily'), ['RRULE:FREQ=DAILY']);
  assert.equal(buildRecurrence([]), undefined);
});

test('fingerprint stable for identical bodies', () => {
  const source = {
    suiType: 'goal',
    suiId: 'goal-9',
    title: 'X',
    deadline: '2026-09-20',
    completed: false,
    gravity: 'low',
  };
  const a = toGoogleEventBody(source);
  const b = toGoogleEventBody(source);
  assert.ok(a && b);
  assert.equal(fingerprintMirrorBody(a), fingerprintMirrorBody(b));
});

test('mirror guards', () => {
  assert.equal(canMirrorGoal({ deadline: '2026-09-20' }), true);
  assert.equal(canMirrorGoal({ deadline: '2026-09-20', mirrorToGoogle: false }), false);
  assert.equal(canMirrorHabit({ mirrorToGoogle: false }), false);
  assert.equal(canMirrorHabit({ plannedTime: '07:30', mirrorToGoogle: true }), true);
});
