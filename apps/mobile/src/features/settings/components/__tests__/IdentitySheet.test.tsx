import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { IdentitySheet } from '../IdentitySheet';
import { useIdentityStore, defaultIdentity } from '@/shared/identity/useIdentityStore';
import {
  pickPhoto,
  saveLocalPhoto,
  removePhotoPreview,
} from '@/shared/infrastructure/profile/localPhoto';
import { syncIdentity } from '@/shared/identity/identitySync';
jest.mock('@/shared/infrastructure/profile/localPhoto', () => ({
  pickPhoto: jest.fn(),
  saveLocalPhoto: jest.fn(async () => 'file:///saved.webp'),
  removeLocalPhoto: jest.fn(async () => undefined),
  removePhotoPreview: jest.fn(),
  resolveLocalPhoto: async (uri?: string) => uri,
}));
jest.mock('@/shared/identity/identitySync', () => ({
  syncIdentity: jest.fn(async () => undefined),
}));
beforeEach(() => {
  jest.clearAllMocks();
  useIdentityStore.setState({ owner: 'local', identity: defaultIdentity(), identities: {} });
});
const mount = () => render(<IdentitySheet visible name="Ana" onClose={jest.fn()} />);
test('color y detalle inmediatos', async () => {
  const screen = await mount();
  await fireEvent.press(screen.getByLabelText('Verde'));
  await waitFor(() => expect(screen.getByText('Emoji').parent?.props.disabled).not.toBe(true));
  await fireEvent.press(screen.getByText('Emoji'));
  expect(useIdentityStore.getState().identity).toMatchObject({
    accentColor: 'green',
    detail: '🌱',
  });
});
test('cancelación no cambia foto; permiso denegado anuncia error', async () => {
  jest.mocked(pickPhoto).mockResolvedValueOnce(null);
  const screen = await mount();
  await fireEvent.press(screen.getByText('Cambiar foto'));
  await waitFor(() => expect(screen.queryByText('Usar foto')).toBeNull());
  await waitFor(() =>
    expect(screen.getByText('Cambiar foto').parent?.props.disabled).not.toBe(true),
  );
  jest.mocked(pickPhoto).mockRejectedValueOnce(new Error('permission-denied'));
  await fireEvent.press(screen.getByText('Cambiar foto'));
  await waitFor(() => expect(screen.getByText(/Permiso denegado/)).toBeTruthy());
  expect(useIdentityStore.getState().identity.localPhotoUri).toBeUndefined();
});
test('preview requiere confirmar, subida exitosa y quitar foto', async () => {
  jest.mocked(pickPhoto).mockResolvedValueOnce('file:///preview.webp');
  const screen = await mount();
  await fireEvent.press(screen.getByText('Cambiar foto'));
  await waitFor(() => expect(screen.getByText('Usar foto')).toBeTruthy());
  expect(saveLocalPhoto).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Usar foto'));
  await waitFor(() => expect(syncIdentity).toHaveBeenCalled());
  expect(removePhotoPreview).toHaveBeenCalledWith('file:///preview.webp');
  await waitFor(() =>
    expect(screen.getByText('Quitar foto').parent?.props.disabled).not.toBe(true),
  );
  await fireEvent.press(screen.getByText('Quitar foto'));
  await waitFor(() => expect(syncIdentity).toHaveBeenCalledWith(true));
  expect(useIdentityStore.getState().identity.localPhotoUri).toBeUndefined();
});
test('copia fallida conserva preview sin eliminar caché', async () => {
  jest.mocked(pickPhoto).mockResolvedValueOnce('file:///cache/preview.webp');
  jest.mocked(saveLocalPhoto).mockRejectedValueOnce(new Error('copy-failed'));
  const screen = await mount();
  await fireEvent.press(screen.getByText('Cambiar foto'));
  await waitFor(() => expect(screen.getByText('Usar foto')).toBeTruthy());
  await fireEvent.press(screen.getByText('Usar foto'));
  await waitFor(() => expect(screen.getByText(/No se pudo guardar/)).toBeTruthy());
  expect(removePhotoPreview).not.toHaveBeenCalled();
  expect(useIdentityStore.getState().identity.localPhotoUri).toBeUndefined();
  expect(screen.getByText('Usar foto')).toBeTruthy();
});
test('subida fallida conserva foto local, reintento disponible', async () => {
  jest.mocked(pickPhoto).mockResolvedValueOnce('file:///preview.webp');
  jest.mocked(syncIdentity).mockRejectedValueOnce(new Error('offline'));
  const screen = await mount();
  await fireEvent.press(screen.getByText('Cambiar foto'));
  await waitFor(() => expect(screen.getByText('Usar foto')).toBeTruthy());
  await fireEvent.press(screen.getByText('Usar foto'));
  await waitFor(() => expect(screen.getByText(/No se pudo sincronizar/)).toBeTruthy());
  expect(useIdentityStore.getState().identity.localPhotoUri).toBe('file:///saved.webp');
  expect(screen.getByText('Reintentar')).toBeTruthy();
});

test('picker de cuenta anterior no deja preview en cuenta nueva', async () => {
  let finish!: (uri: string) => void;
  jest.mocked(pickPhoto).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const screen = await mount();
  await fireEvent.press(screen.getByText('Cambiar foto'));
  useIdentityStore.getState().switchOwner('b');
  finish('file:///previous.webp');
  await waitFor(() => expect(screen.queryByText('Usar foto')).toBeNull());
  expect(useIdentityStore.getState().identity.localPhotoUri).toBeUndefined();
});
test('cancelar o cerrar con preview limpia caché y conserva foto', async () => {
  jest.mocked(pickPhoto).mockResolvedValueOnce('file:///cache/preview.webp');
  const onClose = jest.fn();
  const screen = await render(<IdentitySheet visible name="Ana" onClose={onClose} />);
  await fireEvent.press(screen.getByText('Cambiar foto'));
  await waitFor(() => expect(screen.getByText('Usar foto')).toBeTruthy());
  await fireEvent.press(screen.getByText('Cancelar'));
  expect(removePhotoPreview).toHaveBeenCalledWith('file:///cache/preview.webp');
  expect(screen.queryByText('Usar foto')).toBeNull();
  expect(saveLocalPhoto).not.toHaveBeenCalled();
  jest.mocked(pickPhoto).mockResolvedValueOnce('file:///cache/otro.webp');
  await fireEvent.press(screen.getByText('Cambiar foto'));
  await waitFor(() => expect(screen.getByText('Usar foto')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Cerrar'));
  expect(removePhotoPreview).toHaveBeenCalledWith('file:///cache/otro.webp');
  expect(onClose).toHaveBeenCalled();
});
