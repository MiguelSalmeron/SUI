const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toGoogleTaskBody,
  fingerprintTaskBody,
  toMirrorSource,
} = require('../lib/connections/taskMirrorMapper.js');
const { normalizeTask } = require('../lib/connections/tasksApi.js');

test('una meta sin fecha igual genera tarea (sin due)', () => {
  const body = toGoogleTaskBody({
    suiType: 'goal',
    suiId: 'g1',
    title: 'Leer 20 páginas',
    completed: false,
  });

  assert.ok(body);
  assert.equal(body.title, 'Leer 20 páginas');
  assert.equal(body.status, 'needsAction');
  assert.equal(body.due, undefined);
});

test('una meta con fecha manda due en YYYY-MM-DD', () => {
  const body = toGoogleTaskBody({
    suiType: 'goal',
    suiId: 'g1',
    title: 'Entregar informe',
    dueDate: '2026-11-30',
    completed: false,
  });

  assert.ok(body);
  assert.equal(body.due, '2026-11-30');
});

test('una fecha inválida no se manda: mejor sin due que con una inventada', () => {
  const body = toGoogleTaskBody({
    suiType: 'goal',
    suiId: 'g1',
    title: 'Meta',
    dueDate: 'mañana',
    completed: false,
  });

  assert.ok(body);
  assert.equal(body.due, undefined);
});

test('sin título no hay tarea que escribir', () => {
  assert.equal(toGoogleTaskBody({ suiType: 'goal', suiId: 'g1', title: '  ', completed: false }), null);
});

test('el fingerprint cambia si cambia cualquier campo visible', () => {
  const base = { title: 'Meta', status: 'needsAction' };
  const same = fingerprintTaskBody({ ...base });
  assert.equal(fingerprintTaskBody({ ...base }), same);
  assert.notEqual(fingerprintTaskBody({ ...base, due: '2026-01-01' }), same);
  assert.notEqual(fingerprintTaskBody({ ...base, status: 'completed' }), same);
});

test('toMirrorSource saca la fecha del deadline y nada más', () => {
  const source = toMirrorSource('goal', 'g1', {
    title: 'Meta',
    deadline: '2026-12-01',
    completed: false,
    gravity: 'high',
  });

  assert.ok(source);
  assert.equal(source.dueDate, '2026-12-01');
  assert.equal(source.gravity, 'high');
});

test('un hábito nunca inventa vencimiento', () => {
  const source = toMirrorSource('habit', 'h1', {
    title: 'Correr',
    frequency: 'daily',
    completed: false,
  });

  assert.ok(source);
  assert.equal(source.dueDate, undefined);
});

test('sin título no hay fuente de espejo', () => {
  assert.equal(toMirrorSource('goal', 'g1', { deadline: '2026-12-01' }), null);
});

test('normalizeTask descarta borradas y conserva vencimiento', () => {
  assert.equal(normalizeTask('list-1', { id: 't1', deleted: true }), null);
  assert.equal(normalizeTask('list-1', { deleted: true }), null);

  const task = normalizeTask('list-1', {
    id: 't1',
    title: '  Comprar pan ',
    status: 'needsAction',
    due: '2026-10-09T00:00:00.000Z',
  });

  assert.ok(task);
  assert.equal(task.title, 'Comprar pan');
  assert.equal(task.dueDate, '2026-10-09');
  assert.equal(task.completed, false);
  assert.equal(task.taskListId, 'list-1');
});

test('normalizeTask marca completadas por status', () => {
  const task = normalizeTask('list-1', { id: 't1', title: 'Hecha', status: 'completed' });

  assert.ok(task);
  assert.equal(task.completed, true);
});
