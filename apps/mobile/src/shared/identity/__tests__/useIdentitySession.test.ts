import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useIdentitySession } from '../useIdentitySession';
import { useIdentityStore, defaultIdentity } from '../useIdentityStore';
import { readRemoteIdentity } from '@/shared/infrastructure/profile/identityApi';
import { removeLocalPhoto } from '@/shared/infrastructure/profile/localPhoto';
jest.mock('@/shared/infrastructure/profile/identityApi', () => ({ readRemoteIdentity: jest.fn() }));
jest.mock('@/shared/infrastructure/profile/localPhoto', () => ({
  removeLocalPhoto: jest.fn(async () => undefined),
}));
beforeEach(async () => {
  jest.clearAllMocks();
  await useIdentityStore.persist.rehydrate();
  useIdentityStore.setState({ owner: null, identity: defaultIdentity(), identities: {} });
});
test('misma versión remota conserva archivo local para borrado posterior', async () => {
  const identity = {
    ...defaultIdentity(),
    avatarSource: 'photo' as const,
    photoPath: 'users/a/avatar/avatar.webp',
    photoVersion: 1,
    photoUrl: 'https://storage.test/a',
  };
  useIdentityStore.setState({
    identities: { a: { ...identity, localPhotoUri: 'file:///saved.webp' } },
  });
  jest.mocked(readRemoteIdentity).mockResolvedValueOnce(identity);
  await renderHook(() => useIdentitySession('a', true, false));
  await waitFor(() => expect(readRemoteIdentity).toHaveBeenCalledWith('a'));
  expect(useIdentityStore.getState().identity.localPhotoUri).toBe('file:///saved.webp');
  expect(removeLocalPhoto).not.toHaveBeenCalled();
});
test('lectura remota atrasada no muestra identidad de otra cuenta', async () => {
  let finish!: (identity: ReturnType<typeof defaultIdentity>) => void;
  jest
    .mocked(readRemoteIdentity)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(defaultIdentity());
  const hook = await renderHook<void, { uid: string }>(
    (props) => useIdentitySession(props.uid, true, false),
    { initialProps: { uid: 'a' } },
  );
  await waitFor(() => expect(readRemoteIdentity).toHaveBeenCalledWith('a'));
  await hook.rerender({ uid: 'b' });
  await act(async () => finish({ ...defaultIdentity(), accentColor: 'rose' }));
  expect(useIdentityStore.getState().owner).toBe('b');
  expect(useIdentityStore.getState().identity.accentColor).toBe('blue');
});
