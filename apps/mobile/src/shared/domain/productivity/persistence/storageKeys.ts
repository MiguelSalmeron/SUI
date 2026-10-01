import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export const PRODUCTIVITY_STORAGE_KEY = 'sui-productivity-v9';
export const LEGACY_PRODUCTIVITY_V8_STORAGE_KEY = 'sui-productivity-v8';
export const LEGACY_PRODUCTIVITY_STORAGE_KEY = 'sui-productivity-v7';
const DEVICE_ID_KEY = '@sui/device-id-v1';

/**
 * Clave de almacenamiento para un usuario.
 *
 * Cada uid guarda su propio sobre; la clave base (sin sufijo) es la del
 * invitado. Separarlas evita que un usuario vea datos de otro al cambiar de
 * sesión en el mismo dispositivo.
 */
export const getProductivityStorageKey = (uid?: string | null): string => {
  const normalized = uid?.trim();
  return normalized ? `${PRODUCTIVITY_STORAGE_KEY}:${normalized}` : PRODUCTIVITY_STORAGE_KEY;
};

/**
 * Identidad estable del dispositivo, usada como autor y desambiguador en las
 * mutaciones del outbox. Se genera una sola vez y se reutiliza, porque un id
 * distinto en cada arranque haría ver conflictos falsos entre propios cambios.
 */
export const getDeviceId = async (): Promise<string> => {
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
};
