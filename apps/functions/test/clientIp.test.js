const test = require('node:test');
const assert = require('node:assert/strict');
const { clientIp } = require('../lib/http/clientIp.js');

const requestWith = (headers) => ({ headers, ip: '10.0.0.1' });

test('clientIp toma el último salto de X-Forwarded-For', () => {
  const request = requestWith({ 'x-forwarded-for': '203.0.113.9, 198.51.100.4' });

  assert.equal(clientIp(request), '198.51.100.4');
});

test('clientIp ignora los saltos falsificados por el cliente', () => {
  // El cliente escribe lo que quiere delante; Cloud Run añade la IP real al
  // final. Si se leyera el primer valor, bastaría con inventarlo para obtener
  // un cubo nuevo en cada petición.
  const request = requestWith({
    'x-forwarded-for': '1.2.3.4, 5.6.7.8, 203.0.113.9',
  });

  assert.equal(clientIp(request), '203.0.113.9');
  assert.notEqual(clientIp(request), '1.2.3.4');
});

test('clientIp usa la última cabecera cuando hay varias', () => {
  const request = requestWith({
    'x-forwarded-for': ['1.2.3.4', '203.0.113.9, 198.51.100.4'],
  });

  assert.equal(clientIp(request), '198.51.100.4');
});

test('clientIp limpia espacios y entradas vacías', () => {
  const request = requestWith({ 'x-forwarded-for': ' 1.2.3.4 ,, 203.0.113.9 , ' });

  assert.equal(clientIp(request), '203.0.113.9');
});

test('clientIp no cae a request.ip, que en Cloud Run es el proxy', () => {
  // Un respaldo a request.ip daría un cubo compartido por todo el tráfico y
  // bloquearía a todos los usuarios a la vez.
  assert.equal(clientIp(requestWith({})), undefined);
  assert.equal(clientIp(requestWith({ 'x-forwarded-for': '' })), undefined);
  assert.equal(clientIp(requestWith({ 'x-forwarded-for': ' , ' })), undefined);
});
