import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
const openPhotos = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open('sui-identity', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Photo storage unavailable'));
  });
export async function resolveLocalPhoto(uri?: string): Promise<string | undefined> {
  if (!uri?.startsWith('identity-photo:')) return uri;
  const db = await openPhotos();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('photos').objectStore('photos').get(uri);
      request.onsuccess = () =>
        resolve(request.result instanceof Blob ? URL.createObjectURL(request.result) : undefined);
      request.onerror = () => reject(new Error('Photo unavailable'));
    });
  } finally {
    db.close();
  }
}
export async function photoBlob(uri: string): Promise<Blob> {
  const resolved = await resolveLocalPhoto(uri);
  if (!resolved) throw new Error('Photo unavailable');
  try {
    const response = await fetch(resolved);
    if (!response.ok) throw new Error('Photo unavailable');
    return await response.blob();
  } finally {
    if (uri.startsWith('identity-photo:')) URL.revokeObjectURL(resolved);
  }
}
export async function saveLocalPhoto(uri: string): Promise<string> {
  const key = `identity-photo:${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (Platform.OS !== 'web') {
    const destination = new File(Paths.document, `${key.replace(':', '-')}.webp`);
    new File(uri).copy(destination);
    return destination.uri;
  }
  const blob = await photoBlob(uri);
  const db = await openPhotos();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('photos', 'readwrite');
      transaction.objectStore('photos').put(blob, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Photo storage unavailable'));
    });
  } finally {
    db.close();
  }
  return key;
}
export async function removeLocalPhoto(uri?: string): Promise<void> {
  if (!uri) return;
  if (uri.startsWith('identity-photo:')) {
    const db = await openPhotos();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').delete(uri);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(new Error('Photo deletion failed'));
      });
    } finally {
      db.close();
    }
  } else if (Platform.OS !== 'web' && uri.startsWith(Paths.document.uri)) {
    const file = new File(uri);
    if (file.exists) file.delete();
  }
}
export function removePhotoPreview(uri: string): void {
  if (Platform.OS === 'web') {
    if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
    return;
  }
  const cacheDirectory = `${Paths.cache.uri.replace(/\/$/, '')}/`;
  if (uri.startsWith(cacheDirectory)) {
    const file = new File(uri);
    if (file.exists) file.delete();
  }
}
export async function pickPhoto(): Promise<string | null> {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('permission-denied');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || asset.width <= 0 || asset.height <= 0) throw new Error('Invalid photo');
  const side = Math.min(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  context.crop({
    originX: (asset.width - side) / 2,
    originY: (asset.height - side) / 2,
    width: side,
    height: side,
  });
  context.resize({ width: Math.min(512, side), height: Math.min(512, side) });
  const image = await context.renderAsync();
  const photo = await image.saveAsync({ format: SaveFormat.WEBP, compress: 0.8 });
  const blob = await photoBlob(photo.uri);
  if (blob.size > 1048576 || !['image/webp', 'image/jpeg'].includes(blob.type))
    throw new Error('Photo too large or unsupported');
  return photo.uri;
}
