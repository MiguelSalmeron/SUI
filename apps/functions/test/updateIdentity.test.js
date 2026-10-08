const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
let authentication = { ok: true, uid: 'owner', emailVerified: true, signInProvider: 'password' };
let appCheck = true;
let saved;
let deleted = 0;
let metadataError;
let fileMetadata = { size: 100, contentType: 'image/webp' };
let metadataWrites = 0;
const file = {
  getMetadata: async () => {
    if (metadataError) throw metadataError;
    return [fileMetadata];
  },
  setMetadata: async () => {
    metadataWrites++;
  },
  delete: async () => {
    deleted++;
  },
};
const original = Module._load;
Module._load = function (name, parent, ...args) {
  if (parent?.filename.endsWith('/profile/updateIdentity.js')) {
    if (name === 'firebase-functions/v2/https')
      return { onRequest: (_options, handler) => handler };
    if (name === 'firebase-admin/storage')
      return {
        getStorage: () => ({
          bucket: () => ({
            name: 'private-bucket',
            file: (path) => {
              assert.equal(path, 'users/owner/avatar/avatar.webp');
              return file;
            },
          }),
        }),
      };
    if (name === '../chat/auth') return { authenticateBearer: async () => authentication };
    if (name === '../chat/firebase')
      return {
        firestore: {
          collection: () => ({
            doc: (uid) => {
              assert.equal(uid, 'owner');
              return {
                set: async (value, options) => {
                  assert.deepEqual(options, { mergeFields: ['identity'] });
                  saved = value.identity;
                },
              };
            },
          }),
        },
      };
    if (name === '../http/appCheck') return { verifyAppCheckHeader: async () => appCheck };
    if (name === '../http/cors') return { setCorsHeaders: () => true };
  }
  return original.call(this, name, parent, ...args);
};
const { updateIdentity } = require('../lib/profile/updateIdentity.js');
Module._load = original;
const identity = { schemaVersion: 1, avatarSource: 'initial', accentColor: 'green' };
const invoke = async (body, method = 'POST') => {
  let status;
  let result;
  const response = {
    status: (value) => {
      status = value;
      return response;
    },
    json: (value) => {
      result = value;
    },
    send: () => undefined,
  };
  await updateIdentity({ method, body, headers: { authorization: 'Bearer test' } }, response);
  return { status, result };
};
test('normaliza identidad y reemplaza mapa sin cambiar otros campos', async () => {
  const response = await invoke({ identity, clearPhoto: false });
  assert.equal(response.status, 200);
  assert.equal(saved.accentColor, 'green');
  assert.ok(saved.updatedAt);
});
test('rechaza body inválido, UID, claves desconocidas y path cruzado', async () => {
  for (const body of [
    null,
    {},
    { identity, clearPhoto: false, uid: 'owner' },
    { identity: { ...identity, unknown: true }, clearPhoto: false },
    {
      identity: {
        ...identity,
        avatarSource: 'photo',
        photoVersion: 1,
        photoPath: 'users/other/avatar/avatar.webp',
      },
      clearPhoto: false,
    },
  ])
    assert.equal((await invoke(body)).status, 400);
});
test('ignora URL y fecha del cliente; servidor deriva fecha propia', async () => {
  const response = await invoke({
    identity: { ...identity, photoUrl: 'https://evil.test', updatedAt: 'client-date' },
    clearPhoto: false,
  });
  assert.equal(response.status, 200);
  assert.equal(saved.photoUrl, undefined);
  assert.notEqual(saved.updatedAt, 'client-date');
});
test('auth inválida, anónima, no verificada y App Check inválido', async () => {
  for (const value of [
    { ok: false },
    { ok: true, uid: 'owner', signInProvider: 'anonymous' },
    { ok: true, uid: 'owner', signInProvider: 'password', emailVerified: false },
  ]) {
    authentication = value;
    assert.ok([401, 403].includes((await invoke({ identity, clearPhoto: false })).status));
  }
  authentication = { ok: true, uid: 'owner', emailVerified: true, signInProvider: 'password' };
  appCheck = false;
  assert.equal((await invoke({ identity, clearPhoto: false })).status, 401);
  appCheck = true;
});
test('foto deriva URL de Storage; quitar elimina objeto y metadatos', async () => {
  assert.equal(
    (
      await invoke({
        identity: {
          ...identity,
          avatarSource: 'photo',
          photoVersion: 1,
          photoPath: 'users/owner/avatar/avatar.webp',
        },
        clearPhoto: false,
      })
    ).status,
    200,
  );
  assert.match(saved.photoUrl, /^https:\/\/firebasestorage.googleapis.com/);
  for (let i = 0; i < 2; i++)
    assert.equal((await invoke({ identity, clearPhoto: true })).status, 200);
  assert.equal(deleted, 2);
  assert.equal(saved.photoPath, undefined);
  assert.equal(saved.photoUrl, undefined);
});
test('solo POST, OPTIONS permitido', async () => {
  assert.equal((await invoke({}, 'GET')).status, 405);
  assert.equal((await invoke({}, 'OPTIONS')).status, 204);
});
const photoIdentity = {
  ...identity,
  avatarSource: 'photo',
  photoVersion: 1,
  photoPath: 'users/owner/avatar/avatar.webp',
};
test('foto ausente responde 400 accionable; errores de infra siguen 500', async () => {
  try {
    for (const code of [404, '404']) {
      metadataError = { code };
      const response = await invoke({ identity: photoIdentity, clearPhoto: false });
      assert.equal(response.status, 400);
      assert.equal(response.result.error, 'Photo missing. Choose a photo again.');
    }
    metadataError = { code: 503 };
    assert.equal((await invoke({ identity: photoIdentity, clearPhoto: false })).status, 500);
  } finally {
    metadataError = undefined;
  }
});
test('conserva token existente; URL recibida nunca reemplaza derivación de Storage', async () => {
  const previous = fileMetadata;
  const writes = metadataWrites;
  try {
    fileMetadata = { ...previous, metadata: { firebaseStorageDownloadTokens: 'existing-token' } };
    const response = await invoke({
      identity: { ...photoIdentity, photoUrl: 'https://evil.test', updatedAt: 'client-date' },
      clearPhoto: false,
    });
    assert.equal(response.status, 200);
    assert.match(saved.photoUrl, /^https:\/\/firebasestorage.googleapis.com/);
    assert.match(saved.photoUrl, /token=existing-token$/);
    assert.notEqual(saved.updatedAt, 'client-date');
    assert.equal(metadataWrites, writes);
  } finally {
    fileMetadata = previous;
  }
});
test('foto con tamaño o MIME inválidos sigue rechazada', async () => {
  const previous = fileMetadata;
  try {
    for (const metadata of [
      { size: 1048577, contentType: 'image/webp' },
      { size: 100, contentType: 'text/plain' },
    ]) {
      fileMetadata = metadata;
      assert.equal((await invoke({ identity: photoIdentity, clearPhoto: false })).status, 400);
    }
  } finally {
    fileMetadata = previous;
  }
});
