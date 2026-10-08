import * as Picker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { pickPhoto, removePhotoPreview } from '../localPhoto';
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(Picker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
});
test('limpieza de preview elimina solo archivo dentro de caché nativa', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'ios');
  try {
    removePhotoPreview('file:///documents/saved.webp');
    removePhotoPreview('file:///cache-other/photo.webp');
    expect(File).not.toHaveBeenCalled();
    removePhotoPreview('file:///cache/preview.webp');
    expect(File).toHaveBeenCalledWith('file:///cache/preview.webp');
    expect(jest.mocked(File).mock.instances[0].delete).toHaveBeenCalledTimes(1);
  } finally {
    platform.restore();
  }
});
test('limpieza de preview web revoca blob sin borrar copia persistente', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'web');
  const original = URL.revokeObjectURL;
  const revoke = jest.fn();
  URL.revokeObjectURL = revoke;
  try {
    removePhotoPreview('identity-photo:saved');
    removePhotoPreview('https://storage.test/avatar.webp');
    expect(revoke).not.toHaveBeenCalled();
    removePhotoPreview('blob:preview');
    expect(revoke).toHaveBeenCalledWith('blob:preview');
    expect(File).not.toHaveBeenCalled();
  } finally {
    platform.restore();
    URL.revokeObjectURL = original;
  }
});
test('cancelación y permiso denegado', async () => {
  jest
    .mocked(Picker.launchImageLibraryAsync)
    .mockResolvedValueOnce({ canceled: true, assets: null });
  expect(await pickPhoto()).toBeNull();
  jest
    .mocked(Picker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValueOnce({ granted: false } as never);
  await expect(pickPhoto()).rejects.toThrow('permission-denied');
  expect(Picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
});
test('recorte al centro, máximo 512, WebP y tamaño validado', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    blob: async () => ({ size: 100, type: 'image/webp' }),
  } as Response);
  jest.mocked(Picker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///large.jpg', width: 1200, height: 800 }],
  } as never);
  expect(await pickPhoto()).toBe('file:///photo.webp');
  const context = jest.mocked(ImageManipulator.manipulate).mock.results[0].value;
  expect(context.crop).toHaveBeenCalledWith({ originX: 200, originY: 0, width: 800, height: 800 });
  expect(context.resize).toHaveBeenCalledWith({ width: 512, height: 512 });
  expect(Picker.launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] }),
  );
  fetchMock.mockResolvedValueOnce({
    ok: true,
    blob: async () => ({ size: 1048577, type: 'image/webp' }),
  } as Response);
  await expect(pickPhoto()).rejects.toThrow('Photo too large or unsupported');
  fetchMock.mockRestore();
});
