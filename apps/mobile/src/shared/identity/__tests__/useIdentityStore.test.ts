import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIdentityStore, defaultIdentity } from '../useIdentityStore';
beforeEach(() => {
  useIdentityStore.setState({ owner: null, identity: defaultIdentity(), identities: {} });
});
test('aislamiento por cuenta y regreso a preferencia local', () => {
  const store = useIdentityStore.getState();
  store.switchOwner('local');
  store.setAccentColor('green');
  store.setLocalPhoto('file:///local.webp');
  store.switchOwner('a');
  expect(useIdentityStore.getState().identity.localPhotoUri).toBeUndefined();
  store.setLocalPhoto('file:///a.webp');
  store.switchOwner('b');
  expect(useIdentityStore.getState().identity.localPhotoUri).toBeUndefined();
  store.switchOwner(null);
  expect(useIdentityStore.getState().identity.localPhotoUri).toBeUndefined();
  store.switchOwner('local');
  expect(useIdentityStore.getState().identity.accentColor).toBe('green');
});
test('quitar foto conserva color y emoji; reset elimina cuenta', () => {
  const store = useIdentityStore.getState();
  store.switchOwner('a');
  store.setAccentColor('rose');
  store.setDetail('emoji', '🌱');
  store.setLocalPhoto('file:///a.webp');
  store.clearPhoto();
  expect(useIdentityStore.getState().identity).toMatchObject({
    accentColor: 'rose',
    detail: '🌱',
    avatarSource: 'emoji',
  });
  expect(useIdentityStore.getState().identity.localPhotoUri).toBeUndefined();
  store.reset();
  store.switchOwner('a');
  expect(useIdentityStore.getState().identity).toEqual(defaultIdentity());
});
test('hidratación conserva dueño actual y restaura foto', async () => {
  const store = useIdentityStore.getState();
  store.switchOwner('a');
  store.setLocalPhoto('file:///saved.webp');
  const persisted = await AsyncStorage.getItem('@sui/identity-v1');
  useIdentityStore.setState({ identities: {}, identity: defaultIdentity() });
  await AsyncStorage.setItem('@sui/identity-v1', persisted!);
  await useIdentityStore.persist.rehydrate();
  expect(useIdentityStore.getState().owner).toBe('a');
  expect(useIdentityStore.getState().identity.localPhotoUri).toBe('file:///saved.webp');
});
