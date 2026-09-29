const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateWindow, hashClientKey, checkRateLimit } = require('../lib/chat/rateLimitWindow.js');

/** Consumidor en memoria que imita el cubo de Firestore. */
const consumeFrom = () => {
  const buckets = new Map();
  const consume = async (documentId, max, windowMin) => {
    const now = Date.now();
    const window = evaluateWindow(buckets.get(documentId), now, max, windowMin * 60_000);
    buckets.set(documentId, window.timestamps);
    return window;
  };
  return { consume, buckets };
};

test('evaluateWindow permite mientras hay cupo y registra la marca actual', () => {
  const now = 1_000_000;
  const result = evaluateWindow([now - 5_000], now, 3, 60_000);

  assert.equal(result.allowed, true);
  assert.equal(result.retryAfterSec, 0);
  assert.deepEqual(result.timestamps, [now - 5_000, now]);
});

test('evaluateWindow bloquea al alcanzar el máximo y calcula la espera', () => {
  const now = 1_000_000;
  const oldest = now - 1_000;
  const result = evaluateWindow([oldest], now, 1, 60_000);

  assert.equal(result.allowed, false);
  // (oldest + 60000 - now) / 1000 = 59
  assert.equal(result.retryAfterSec, 59);
  assert.deepEqual(result.timestamps, [oldest], 'no registra la petición rechazada');
});

test('evaluateWindow descarta las marcas fuera de la ventana', () => {
  const now = 1_000_000;
  const result = evaluateWindow([now - 120_000, now - 90_000], now, 1, 60_000);

  assert.equal(result.allowed, true);
  assert.deepEqual(result.timestamps, [now]);
});

test('evaluateWindow trata la ausencia de historial como cubo vacío', () => {
  const result = evaluateWindow(undefined, 1_000_000, 1, 60_000);

  assert.equal(result.allowed, true);
  assert.deepEqual(result.timestamps, [1_000_000]);
});

test('hashClientKey es estable y no expone el valor original', () => {
  const first = hashClientKey('203.0.113.7');
  const second = hashClientKey('203.0.113.7');

  assert.equal(first, second);
  assert.equal(first.length, 32);
  assert.ok(!first.includes('203.0.113.7'));
  assert.notEqual(first, hashClientKey('203.0.113.8'));
});

test('checkRateLimit bloquea por IP sin consumir el cupo del usuario', async () => {
  const { consume, buckets } = consumeFrom();
  const limits = { perUser: 5, perIp: 1, windowMin: 60 };

  const first = await checkRateLimit({ uid: 'u1', clientIp: '1.1.1.1' }, consume, limits);
  assert.equal(first.allowed, true);

  // Misma IP, uid recién fabricado: el cupo por usuario no debe salvarle.
  const second = await checkRateLimit({ uid: 'u2', clientIp: '1.1.1.1' }, consume, limits);
  assert.equal(second.allowed, false);
  assert.equal(second.scope, 'ip');
  assert.ok(second.retryAfterSec > 0);

  assert.ok(buckets.has('u1'));
  assert.equal(buckets.has('u2'), false, 'no gasta el cubo del usuario si la IP ya está agotada');
});

test('checkRateLimit bloquea por usuario cuando la IP tiene cupo', async () => {
  const { consume } = consumeFrom();
  const limits = { perUser: 1, perIp: 10, windowMin: 60 };

  const first = await checkRateLimit({ uid: 'u1', clientIp: '1.1.1.1' }, consume, limits);
  assert.equal(first.allowed, true);

  const second = await checkRateLimit({ uid: 'u1', clientIp: '2.2.2.2' }, consume, limits);
  assert.equal(second.allowed, false);
  assert.equal(second.scope, 'uid');
});

test('checkRateLimit sin IP sólo consume el cubo del usuario', async () => {
  const { consume, buckets } = consumeFrom();

  const result = await checkRateLimit({ uid: 'u1' }, consume, {
    perUser: 5,
    perIp: 5,
    windowMin: 60,
  });

  assert.equal(result.allowed, true);
  assert.deepEqual([...buckets.keys()], ['u1']);
});
