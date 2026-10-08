import { syncIdentity } from '../identitySync';
import { useIdentityStore, defaultIdentity } from '../useIdentityStore';
import {
  identityOwner,
  uploadAvatar,
  updateRemoteIdentity,
} from '@/shared/infrastructure/profile/identityApi';
jest.mock('@/shared/infrastructure/profile/identityApi', () => ({
  identityOwner: jest.fn(() => 'a'),
  uploadAvatar: jest.fn(async () => undefined),
  updateRemoteIdentity: jest.fn(async (identity) => ({
    ...identity,
    photoUrl: 'https://storage.test/a',
  })),
}));
jest.mock('@/shared/infrastructure/profile/localPhoto', () => ({
  photoBlob: jest.fn(async () => new Blob(['photo'], { type: 'image/webp' })),
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(identityOwner).mockReturnValue('a');
  useIdentityStore.setState({ owner: 'a', identity: defaultIdentity(), identities: {} });
});
test('sube bytes antes de metadatos; nunca URI local en endpoint', async () => {
  useIdentityStore.getState().setLocalPhoto('file:///a.webp');
  await syncIdentity();
  expect(uploadAvatar).toHaveBeenCalled();
  expect(jest.mocked(uploadAvatar).mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(updateRemoteIdentity).mock.invocationCallOrder[0],
  );
  expect(useIdentityStore.getState().identity.pending).toBe(false);
});
test('respuesta vieja no pisa otra cuenta', async () => {
  let finish!: (identity: ReturnType<typeof defaultIdentity>) => void;
  jest.mocked(updateRemoteIdentity).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  useIdentityStore.getState().setAccentColor('green');
  const operation = syncIdentity();
  for (let i = 0; i < 10 && !finish; i++) await Promise.resolve();
  useIdentityStore.getState().switchOwner('b');
  finish({ ...defaultIdentity(), accentColor: 'green' });
  await operation;
  expect(useIdentityStore.getState().identity.accentColor).toBe('blue');
});
test('subida fallida conserva foto pendiente y no escribe metadatos', async () => {
  jest.mocked(uploadAvatar).mockRejectedValueOnce(new Error('offline'));
  useIdentityStore.getState().setLocalPhoto('file:///a.webp');
  await expect(syncIdentity()).rejects.toThrow('offline');
  expect(updateRemoteIdentity).not.toHaveBeenCalled();
  expect(useIdentityStore.getState().identity).toMatchObject({
    localPhotoUri: 'file:///a.webp',
    pending: true,
  });
});
test('anónimo/local no usa nube', async () => {
  jest.mocked(identityOwner).mockReturnValue(null);
  useIdentityStore.getState().switchOwner('local');
  useIdentityStore.getState().setAccentColor('green');
  await syncIdentity();
  expect(updateRemoteIdentity).not.toHaveBeenCalled();
  expect(uploadAvatar).not.toHaveBeenCalled();
});

test('cambiar color con foto sincronizada no vuelve a subir bytes', async () => {
  useIdentityStore.getState().setLocalPhoto('file:///a.webp');
  await syncIdentity();
  useIdentityStore.getState().setAccentColor('rose');
  await syncIdentity();
  expect(uploadAvatar).toHaveBeenCalledTimes(1);
  expect(updateRemoteIdentity).toHaveBeenCalledTimes(2);
});
