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
  /** Idioma de interfaz; default de producto es español, system sigue al dispositivo solo si se elige a mano. */
  language: LanguagePreference;
  /** Modo de tema; default de producto es claro, system sigue al dispositivo solo si se elige a mano. */
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
// Deuda post-Kronox: el tema vive en dos claves (`@sui/settings-v1` como dueño
// y `@sui/theme-mode` como espejo que escribe `setTheme`). Acá no se unifica:
// el espejo se conserva tal cual para no ampliar el alcance de la RC.
const THEME_MODE_KEY = '@sui/theme-mode';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notificationsEnabled: false,
      fontSize: 'medium',
      // Default de producto: instalación limpia arranca en español y claro.
      // System sigue disponible como opción manual en Ajustes.
      language: 'es',
      theme: 'light',
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
  // Fijate que tema e idioma no se tocan a propósito: la copia del sobre es un
  // snapshot que solo se refresca en `saveState`, así que una elección explícita
  // en Ajustes quedaba pisada por un valor viejo al reabrir la app. En esta RC
  // la apariencia manda en el dispositivo y el sobre solo aporta el resto.
  // El idioma comparte el mismo camino stale que el tema, por eso entra acá
  // sin ampliar el alcance: mismo `saveState` fuera del debounce.
  if (typeof preferences.notificationsEnabled === 'boolean') {
    store.setNotificationsEnabled(preferences.notificationsEnabled);
  }
};
