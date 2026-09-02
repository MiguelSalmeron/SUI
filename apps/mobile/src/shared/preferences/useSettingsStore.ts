import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FontSize = 'small' | 'medium' | 'large';
export type LanguagePreference = 'system' | 'es' | 'en';

export interface SettingsState {
  /** Recordatorio nocturno local habilitado. */
  notificationsEnabled: boolean;
  /** Tamaño de fuente aplicado a la escala tipográfica global */
  fontSize: FontSize;
  /** Idioma de interfaz; system sigue configuración del dispositivo. */
  language: LanguagePreference;

  // Actions
  setNotificationsEnabled: (enabled: boolean) => void;
  setFontSize: (size: FontSize) => void;
  setLanguage: (lang: LanguagePreference) => void;
}

const SETTINGS_STORAGE_KEY = '@sui/settings-v1';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notificationsEnabled: false,
      fontSize: 'medium',
      language: 'system',

      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
