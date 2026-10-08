import fs from 'node:fs/promises';
import { before, after, test } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
let environment;
before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'sui-rules-test',
    storage: { rules: await fs.readFile('storage.rules', 'utf8') },
  });
});
after(async () => environment.cleanup());
const storage = (uid, provider = 'password', verified = true) =>
  environment
    .authenticatedContext(uid, {
      firebase: { sign_in_provider: provider },
      email_verified: verified,
    })
    .storage();
const path = 'users/owner/avatar/avatar.webp';
const upload = (sdk, name = path, type = 'image/webp', size = 20) =>
  uploadBytes(ref(sdk, name), new Uint8Array(size), { contentType: type });
test('dueño verificado sube, lee y elimina avatar canónico', async () => {
  const sdk = storage('owner');
  await assertSucceeds(upload(sdk));
  await assertSucceeds(getBytes(ref(sdk, path)));
  await assertSucceeds(deleteObject(ref(sdk, path)));
});
test('Google registrado también puede subir JPEG', async () => {
  await assertSucceeds(upload(storage('owner', 'google.com', false), path, 'image/jpeg'));
});
test('cuenta cruzada no lee, escribe ni elimina', async () => {
  await assertSucceeds(upload(storage('owner')));
  const sdk = storage('other');
  await assertFails(upload(sdk));
  await assertFails(getBytes(ref(sdk, path)));
  await assertFails(deleteObject(ref(sdk, path)));
});
for (const [name, provider, verified] of [
  ['anónimo', 'anonymous', false],
  ['sin verificar', 'password', false],
])
  test(`${name}: lectura, escritura y eliminación rechazadas`, async () => {
    await assertSucceeds(upload(storage('owner')));
    const sdk = storage('owner', provider, verified);
    await assertFails(upload(sdk));
    await assertFails(getBytes(ref(sdk, path)));
    await assertFails(deleteObject(ref(sdk, path)));
  });
test('sin auth rechazado', async () => {
  await assertFails(upload(environment.unauthenticatedContext().storage()));
});
test('MIME, tamaño y path inválidos rechazados', async () => {
  const sdk = storage('owner');
  await assertFails(upload(sdk, path, 'text/plain'));
  await assertFails(upload(sdk, path, 'image/webp', 1048577));
  await assertFails(upload(sdk, 'users/owner/avatar/other.webp'));
  await assertFails(upload(sdk, 'public/avatar.webp'));
  await assertSucceeds(upload(sdk, path, 'image/webp', 1048576));
});
