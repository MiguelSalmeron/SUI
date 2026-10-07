/**
 * Mini-store externo del modo de tema (light/dark/system).
 *
 * Vive fuera de React para que la preferencia persistida en AsyncStorage no
 * obligue a un provider y para evitar parpadeos en el primer render. El modo
 * también se refleja en `useSettingsStore`; acá se mantiene la caché sincrónica
 * que leen los hooks como espejo, sin reemplazar al store principal.
 * Default inicial claro para alinear con el default de producto.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '@/shared/preferences/useSettingsStore';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_MODE_KEY = '@sui/theme-mode';

type Listener = (mode: ThemeMode) => void;

const themeModeListeners = new Set<Listener>();
// Espejo del default de producto en useSettingsStore; system sigue válido si hay valor guardado.
let themeModeCache: ThemeMode = 'light';
let themeModeHydrated = false;

const loadThemeMode = async (): Promise<ThemeMode> => {
  if (themeModeHydrated) return themeModeCache;
  try {
    const raw = await AsyncStorage.getItem(THEME_MODE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      themeModeCache = raw;
    }
  } catch {
    // ignore — default claro de producto
  }
  themeModeHydrated = true;
  // Notificar tras hidratación: el primer render pudo usar el default
  // claro mientras AsyncStorage resolvía. Sin esto, la preferencia
  // persistida nunca se aplica si difiere del default.
  themeModeListeners.forEach((cb) => cb(themeModeCache));
  return themeModeCache;
};

const persistThemeMode = async (mode: ThemeMode): Promise<void> => {
  themeModeCache = mode;
  themeModeHydrated = true;
  try {
    await AsyncStorage.setItem(THEME_MODE_KEY, mode);
  } catch {
    // best-effort
  }
  themeModeListeners.forEach((cb) => cb(mode));
};

export const getThemeMode = (): ThemeMode => {
  const storeMode = useSettingsStore.getState().theme;
  return storeMode || themeModeCache;
};

export const setThemeMode = async (mode: ThemeMode): Promise<void> => {
  // Fijate que el store se escribe primero y se persiste después: el snapshot
  // de `getThemeMode()` lee el store antes que la caché, así que notificar
  // antes de escribir dejaba al provider con el valor viejo y React descartaba
  // el re-render (el primer toque se perdía y recién el segundo cambiaba).
  if (useSettingsStore.getState().theme !== mode) {
    useSettingsStore.getState().setTheme(mode);
  }
  await persistThemeMode(mode);
};

export const subscribeThemeMode = (cb: Listener): (() => void) => {
  themeModeListeners.add(cb);
  return () => {
    themeModeListeners.delete(cb);
  };
};

useSettingsStore.subscribe((state, prevState) => {
  if (state.theme !== prevState.theme && state.theme !== themeModeCache) {
    themeModeCache = state.theme;
    themeModeListeners.forEach((cb) => cb(state.theme));
  }
});

// Hidratar al cargar el módulo (no bloqueante).
void loadThemeMode();
