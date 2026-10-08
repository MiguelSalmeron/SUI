const test = require('node:test');
const assert = require('node:assert/strict');
const { parseIdentity, avatarPath } = require('../dist');
const valid = { schemaVersion: 1, avatarSource: 'initial', accentColor: 'blue' };
test('identidad acepta catálogo cerrado y foto canónica', () => {
  assert.deepEqual(parseIdentity(valid, 'owner'), valid);
  assert.ok(
    parseIdentity(
      { ...valid, avatarSource: 'photo', photoPath: avatarPath('owner'), photoVersion: 1 },
      'owner',
    ),
  );
});
test('rechaza UID, claves desconocidas, path cruzado, catálogo y versiones inválidas', () => {
  for (const patch of [
    { uid: 'owner' },
    { unknown: 'value' },
    { accentColor: '#fff' },
    { detail: 'texto' },
    { schemaVersion: 2 },
    { avatarSource: 'emoji' },
    { avatarSource: 'photo', photoPath: avatarPath('other'), photoVersion: 1 },
    { avatarSource: 'photo', photoPath: avatarPath('owner'), photoVersion: -1 },
  ])
    assert.equal(parseIdentity({ ...valid, ...patch }, 'owner'), null);
});
test('ignora URL y fecha derivadas sin mutar entrada ni conservar valores del cliente', () => {
  const input = { ...valid, photoUrl: 'https://external.test', updatedAt: 'client-date' };
  assert.deepEqual(parseIdentity(input, 'owner'), valid);
  assert.equal(input.photoUrl, 'https://external.test');
  assert.equal(input.updatedAt, 'client-date');
  assert.deepEqual(parseIdentity({ ...valid, photoUrl: {}, updatedAt: 42 }, 'owner'), valid);
});
