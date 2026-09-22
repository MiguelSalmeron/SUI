const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveMirrorCalendarId,
  canCreateSecondaryCalendars,
} = require('../lib/connections/mirrorCalendar.js');

const EVENTS_ONLY = 'https://www.googleapis.com/auth/calendar.events openid';
const EVENTS_READONLY = 'https://www.googleapis.com/auth/calendar.events.readonly';
const APP_CREATED = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.app.created';

test('calendar.events sólo → escribe en el calendario primario', async () => {
  let ensureCalled = 0;
  const calendarId = await resolveMirrorCalendarId('token', EVENTS_ONLY, async () => {
    ensureCalled += 1;
    return 'dedicated-id';
  });

  assert.equal(calendarId, 'primary');
  assert.equal(ensureCalled, 0);
});

test('readonly no permite calendario dedicado', () => {
  assert.equal(canCreateSecondaryCalendars(EVENTS_READONLY), false);
  assert.equal(canCreateSecondaryCalendars(EVENTS_ONLY), false);
  assert.equal(canCreateSecondaryCalendars(APP_CREATED), true);
  assert.equal(canCreateSecondaryCalendars(undefined), false);
});

test('con scope de creación usa el calendario dedicado', async () => {
  const calendarId = await resolveMirrorCalendarId('token', APP_CREATED, async () => 'dedicated-id');
  assert.equal(calendarId, 'dedicated-id');
});

test('si falla el dedicado cae al primario sin romper el espejo', async () => {
  const calendarId = await resolveMirrorCalendarId('token', APP_CREATED, async () => {
    throw new Error('403 calendar_create_failed');
  });
  assert.equal(calendarId, 'primary');
});

test('scope vacío o indefinido → primario', async () => {
  const calendarId = await resolveMirrorCalendarId('token', '', async () => 'never');
  assert.equal(calendarId, 'primary');
});
