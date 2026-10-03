import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MirrorPreferences, UserPreferences } from '@sui/contracts';
import { DEFAULT_MIRROR_PREFS } from '@sui/contracts';

export type FontSize = 'small' | 'medium' | 'large';
export type LanguagePreference = 'system' | 'es' | 'en';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface SettingsState {
  /** Recordatorio nocturno local habilitado. */
  notificationsEnabled: boolean;
  /** Tamaño de fuente aplicado a la escala tipográfica global */
  fontSize: FontSize;
  /** Idioma de interfaz; system sigue configuración del dispositivo. */
  language: LanguagePreference;
  /** Modo de tema; system sigue configuración del dispositivo. */
  theme: ThemePreference;

  /** Espejo Google: metas con fecha (default on). */
  mirrorGoalsEnabled: boolean;
  /** Espejo Google: hábitos con horario (default off). */
  mirrorHabitsEnabled: boolean;
  /** Fila fantasma de Calendar descartada (default false). */
  calendarConnectDismissed: boolean;

  // Actions
  setNotificationsEnabled: (enabled: boolean) => void;
  setFontSize: (size: FontSize) => void;
  setLanguage: (lang: LanguagePreference) => void;
  setTheme: (theme: ThemePreference) => void;
  setMirrorGoalsEnabled: (enabled: boolean) => void;
  setMirrorHabitsEnabled: (enabled: boolean) => void;
  setCalendarConnectDismissed: (dismissed: boolean) => void;
}

const SETTINGS_STORAGE_KEY = '@sui/settings-v1';
const THEME_MODE_KEY = '@sui/theme-mode';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notificationsEnabled: false,
      fontSize: 'medium',
      language: 'system',
      theme: 'system',
      mirrorGoalsEnabled: DEFAULT_MIRROR_PREFS.goalsEnabled,
      mirrorHabitsEnabled: DEFAULT_MIRROR_PREFS.habitsEnabled,
      calendarConnectDismissed: false,

      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLanguage: (language) => set({ language }),
      setMirrorGoalsEnabled: (mirrorGoalsEnabled) => set({ mirrorGoalsEnabled }),
      setMirrorHabitsEnabled: (mirrorHabitsEnabled) => set({ mirrorHabitsEnabled }),
      setCalendarConnectDismissed: (calendarConnectDismissed) =>
        set({ calendarConnectDismissed }),
      setTheme: (theme) => {
        set({ theme });
        void AsyncStorage.setItem(THEME_MODE_KEY, theme);
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const getMirrorPreferences = (): MirrorPreferences => {
  const current = useSettingsStore.getState();
  return {
    goalsEnabled: current.mirrorGoalsEnabled,
    habitsEnabled: current.mirrorHabitsEnabled,
  };
};

export const getCurrentPreferences = (): UserPreferences => {
  const current = useSettingsStore.getState();
  return {
    schemaVersion: 1,
    theme: current.theme,
    fontSize: current.fontSize,
    language: current.language,
    notificationsEnabled: current.notificationsEnabled,
    updatedAt: new Date().toISOString(),
  };
};

export const applyUserPreferences = (preferences: UserPreferences): void => {
  const store = useSettingsStore.getState();
  if (preferences.fontSize) {
    store.setFontSize(preferences.fontSize);
  }
  if (preferences.language) {
    store.setLanguage(preferences.language);
  }
  if (typeof preferences.notificationsEnabled === 'boolean') {
    store.setNotificationsEnabled(preferences.notificationsEnabled);
  }
  if (preferences.theme) {
    store.setTheme(preferences.theme);
  }
};
