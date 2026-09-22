const test = require('node:test');
const assert = require('node:assert/strict');
const {
  fetchCalendarEvents,
  normalizeEvent,
  CalendarFetchError,
  SYNC_WINDOW_DAYS_PAST,
  SYNC_WINDOW_DAYS_FUTURE,
} = require('../lib/connections/calendarFetch.js');

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const page = (items, nextPageToken) => jsonResponse({ items, nextPageToken });

test('pagina resultados hasta agotar nextPageToken', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (calls.length === 1) {
      return page([{ id: 'a', summary: 'A', start: { dateTime: '2026-09-01T10:00:00Z' } }], 'token-2');
    }
    return page([{ id: 'b', summary: 'B', start: { dateTime: '2026-09-02T10:00:00Z' } }]);
  };

  const events = await fetchCalendarEvents('token', { fetchImpl });

  assert.equal(calls.length, 2);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.id), ['a', 'b']);
  assert.ok(calls[1].includes('pageToken=token-2'));
});

test('ventana temporal cubre pasado y futuro configurados', async () => {
  let url = '';
  const fetchImpl = async (requested) => {
    url = String(requested);
    return page([]);
  };
  const now = new Date('2026-09-10T12:00:00Z');

  await fetchCalendarEvents('token', { fetchImpl, now });

  const params = new URL(url).searchParams;
  const expectedMin = new Date(now);
  expectedMin.setDate(expectedMin.getDate() - SYNC_WINDOW_DAYS_PAST);
  const expectedMax = new Date(now);
  expectedMax.setDate(expectedMax.getDate() + SYNC_WINDOW_DAYS_FUTURE);
  assert.equal(params.get('timeMin'), expectedMin.toISOString());
  assert.equal(params.get('timeMax'), expectedMax.toISOString());
});

test('401/429/5xx se mapean a reconnect_required/rate_limited/calendar_fetch_failed', async () => {
  await assert.rejects(
    fetchCalendarEvents('token', { fetchImpl: async () => jsonResponse({}, 401) }),
    (error) => error instanceof CalendarFetchError && error.code === 'reconnect_required',
  );
  await assert.rejects(
    fetchCalendarEvents('token', { fetchImpl: async () => jsonResponse({}, 429) }),
    (error) => error instanceof CalendarFetchError && error.code === 'rate_limited',
  );
  await assert.rejects(
    fetchCalendarEvents('token', { fetchImpl: async () => jsonResponse({}, 500) }),
    (error) => error instanceof CalendarFetchError && error.code === 'calendar_fetch_failed',
  );
});

test('evento all-day multi-día: end exclusivo se ajusta al último día inclusive', () => {
  const normalized = normalizeEvent({
    id: 'trip',
    summary: 'Viaje',
    start: { date: '2026-09-01' },
    end: { date: '2026-09-03' },
  });

  assert.ok(normalized);
  assert.equal(normalized.allDay, true);
  assert.equal(normalized.date, '2026-09-01');
  assert.equal(normalized.startAt, '2026-09-01T00:00:00');
  // Google da end.date exclusivo (2026-09-03); el último día vigente es el 02.
  assert.equal(normalized.endAt, '2026-09-02T00:00:00');
});

test('descarta cancelados, sin id y sin start; ordena por startAt', async () => {
  const events = await fetchCalendarEvents('token', {
    fetchImpl: async () =>
      page([
        { id: 'z', summary: 'Z', start: { dateTime: '2026-09-03T10:00:00Z' } },
        { id: 'cancelled', status: 'cancelled', start: { dateTime: '2026-09-01T10:00:00Z' } },
        { summary: 'sin id', start: { dateTime: '2026-09-01T09:00:00Z' } },
        { id: 'no-start', summary: 'sin start' },
        { id: 'a', summary: 'A', start: { dateTime: '2026-09-01T08:00:00Z' } },
      ]),
  });

  assert.deepEqual(events.map((event) => event.id), ['a', 'z']);
});

test('normaliza ubicación, timezone y título vacío', () => {
  const normalized = normalizeEvent({
    id: 'e1',
    summary: '  Con examenes  ',
    location: '  Aula 3  ',
    start: { dateTime: '2026-09-01T08:30:00', timeZone: 'America/Managua' },
  });

  assert.ok(normalized);
  assert.equal(normalized.title, 'Con examenes');
  assert.equal(normalized.location, 'Aula 3');
  assert.equal(normalized.time, '08:30');
  assert.equal(normalized.timeZone, 'America/Managua');
});
