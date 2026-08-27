import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FontSize = 'small' | 'medium' | 'large';

export interface SettingsState {
  /** Notificaciones push habilitadas (UI stub — la lógica real se integra después) */
  notificationsEnabled: boolean;
  /** Tamaño de fuente aplicado a la escala tipográfica global */
  fontSize: FontSize;
  /** Idioma (UI stub — internacionalización futura) */
  language: string;

  // Actions
  setNotificationsEnabled: (enabled: boolean) => void;
  setFontSize: (size: FontSize) => void;
  setLanguage: (lang: string) => void;
}

const SETTINGS_STORAGE_KEY = '@sui/settings-v1';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notificationsEnabled: true,
      fontSize: 'medium',
      language: 'es',

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
