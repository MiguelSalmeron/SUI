/**
 * Sistema de diseño SUI — Material Design v3 (Google).
 *
 * - Light scheme por defecto; dark scheme completo.
 * - Tokens semánticos (primary, surface, onSurface, …) según MD3.
 * - useAppTheme() expone los tokens del esquema activo (light/dark/system).
 * - ThemeProvider persiste el modo en AsyncStorage vía el mini-store local.
 *
 * Convenciones:
 *   - NUNCA uses colores hex hardcodeados fuera de este archivo.
 *   - NUNCA importes MD3_LIGHT o MD3_DARK directamente desde componentes.
 *   - Usa useAppTheme() para tokens dinámicos.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ──────────────────────────────────────────────────────────────────────────
// THEME MODE STORE (mini-store local, persistido en AsyncStorage)
// ──────────────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_MODE_KEY = '@sui/theme-mode';

type Listener = (mode: ThemeMode) => void;

const themeModeListeners = new Set<Listener>();
let themeModeCache: ThemeMode = 'system';
let themeModeHydrated = false;

const loadThemeMode = async (): Promise<ThemeMode> => {
  if (themeModeHydrated) return themeModeCache;
  try {
    const raw = await AsyncStorage.getItem(THEME_MODE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      themeModeCache = raw;
    }
  } catch {
    // ignore — default 'system'
  }
  themeModeHydrated = true;
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

export const getThemeMode = (): ThemeMode => themeModeCache;

export const setThemeMode = async (mode: ThemeMode): Promise<void> => {
  await persistThemeMode(mode);
};

export const subscribeThemeMode = (cb: Listener): (() => void) => {
  themeModeListeners.add(cb);
  return () => {
    themeModeListeners.delete(cb);
  };
};

// Hidratar al cargar el módulo (no bloqueante).
void loadThemeMode();

// ──────────────────────────────────────────────────────────────────────────
// COLOR SCHEME (tipo compartido)
// ──────────────────────────────────────────────────────────────────────────

export type ColorScheme = {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceContainerLow: string;
  surfaceContainerLowest: string;
  outline: string;
  outlineVariant: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  success: string;
  onSuccess: string;
  successContainer: string;
  onSuccessContainer: string;
  flame: string;
  flameContainer: string;
  flameOutline: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  scrim: string;
};

// ──────────────────────────────────────────────────────────────────────────
// MD3 · COLOR (light scheme)
// ──────────────────────────────────────────────────────────────────────────
export const MD3_LIGHT: ColorScheme = {
  primary: '#0047AB',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D3E3FD',
  onPrimaryContainer: '#001A41',

  secondary: '#007FFF',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#DBE7FF',
  onSecondaryContainer: '#001A41',

  tertiary: '#5C6BC0',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#E0E5FF',
  onTertiaryContainer: '#0F1A6E',

  background: '#F8FBFF',
  onBackground: '#1A1C1E',
  surface: '#FFFFFF',
  onSurface: '#1A1C1E',
  surfaceVariant: '#E1E3E6',
  onSurfaceVariant: '#44474E',
  surfaceContainer: '#F1F4F9',
  surfaceContainerHigh: '#EBEEF3',
  surfaceContainerHighest: '#E5E8ED',
  surfaceContainerLow: '#F7F9FC',
  surfaceContainerLowest: '#FFFFFF',

  outline: '#74777F',
  outlineVariant: '#C4C6D0',

  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  success: '#2E7D32',
  onSuccess: '#FFFFFF',
  successContainer: '#CFE9D2',
  onSuccessContainer: '#07250B',

  flame: '#FF7A1A',
  flameContainer: '#FFF4EC',
  flameOutline: '#FFD9BF',

  inverseSurface: '#2F3033',
  inverseOnSurface: '#F1F0F4',
  inversePrimary: '#A8C7FA',

  scrim: 'rgba(0, 0, 0, 0.32)',
};

// ──────────────────────────────────────────────────────────────────────────
// MD3 · COLOR (dark scheme)
// ──────────────────────────────────────────────────────────────────────────
export const MD3_DARK: ColorScheme = {
  primary: '#A8C7FA',
  onPrimary: '#002E69',
  primaryContainer: '#004494',
  onPrimaryContainer: '#D3E3FD',

  secondary: '#ABC7FF',
  onSecondary: '#002F65',
  secondaryContainer: '#00468F',
  onSecondaryContainer: '#DBE7FF',

  tertiary: '#BFC4FF',
  onTertiary: '#1B2767',
  tertiaryContainer: '#353F80',
  onTertiaryContainer: '#E0E5FF',

  background: '#131318',
  onBackground: '#E3E3E9',
  surface: '#131318',
  onSurface: '#E3E3E9',
  surfaceVariant: '#44474E',
  onSurfaceVariant: '#C4C6D0',
  surfaceContainer: '#1F1F25',
  surfaceContainerHigh: '#292A2F',
  surfaceContainerHighest: '#34353A',
  surfaceContainerLow: '#191A1F',
  surfaceContainerLowest: '#0D0E12',

  outline: '#8E9099',
  outlineVariant: '#44474E',

  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  success: '#A6D6A9',
  onSuccess: '#0B3910',
  successContainer: '#1F5124',
  onSuccessContainer: '#CFE9D2',

  flame: '#FFB77A',
  flameContainer: '#4A2D1A',
  flameOutline: '#6B4325',

  inverseSurface: '#E3E3E9',
  inverseOnSurface: '#2F3033',
  inversePrimary: '#0047AB',

  scrim: 'rgba(0, 0, 0, 0.55)',
};

/**
 * Alias temporal — los componentes legacy referencian `MD3_COLORS.primary`
 * directamente. En F3 cada componente se refactorizará a `useAppTheme().colors`.
 * Por ahora, MD3_COLORS apunta al esquema light como default.
 */
export const MD3_COLORS = MD3_LIGHT;

// ──────────────────────────────────────────────────────────────────────────
// MD3 · ELEVATION (sombras suaves por nivel)
// ──────────────────────────────────────────────────────────────────────────

export type Elevation = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

const elevation = (
  height: number,
  opacity: number,
  radius: number,
  elev: number,
): Elevation => ({
  shadowColor: '#000000',
  shadowOffset: { width: 0, height },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation: elev,
});

export const MD3_ELEVATION: Record<string, Elevation> = {
  level0: elevation(0, 0, 0, 0),
  level1: elevation(1, 0.05, 3, 1),
  level2: elevation(2, 0.08, 6, 3),
  level3: elevation(4, 0.1, 10, 6),
  level4: elevation(6, 0.12, 14, 8),
  level5: elevation(8, 0.14, 18, 12),
};

// ──────────────────────────────────────────────────────────────────────────
// MD3 · SHAPE (radios de esquina)
// ──────────────────────────────────────────────────────────────────────────
export const MD3_RADIUS = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  full: 9999,
} as const;

// ──────────────────────────────────────────────────────────────────────────
// MD3 · TYPOGRAPHY (escala tipográfica)
// ──────────────────────────────────────────────────────────────────────────

export type TypeStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700' | '800' | '900';
  letterSpacing?: number;
};

export const MD3_TYPE: Record<string, TypeStyle> = {
  displayLg: { fontSize: 52, lineHeight: 60, fontWeight: '900' },
  displayMd: { fontSize: 40, lineHeight: 48, fontWeight: '900' },
  displaySm: { fontSize: 32, lineHeight: 40, fontWeight: '800' },

  headlineLg: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  headlineMd: { fontSize: 26, lineHeight: 34, fontWeight: '800' },
  headlineSm: { fontSize: 22, lineHeight: 30, fontWeight: '800' },

  titleLg: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  titleMd: { fontSize: 16, lineHeight: 24, fontWeight: '700', letterSpacing: 0.15 },
  titleSm: { fontSize: 14, lineHeight: 20, fontWeight: '700', letterSpacing: 0.1 },

  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  bodySm: { fontSize: 12, lineHeight: 16, fontWeight: '400' },

  labelLg: { fontSize: 14, lineHeight: 20, fontWeight: '700', letterSpacing: 0.1 },
  labelMd: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.5 },
  labelSm: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.5 },
};

// ──────────────────────────────────────────────────────────────────────────
// MD3 · MOTION (easing curves + durations)
// ──────────────────────────────────────────────────────────────────────────
export const MD3_MOTION = {
  easing: {
    emphasized: { duration: 500, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    emphasizedDecelerate: { duration: 400, easing: 'cubic-bezier(0.05, 0.7, 0.1, 1)' },
    emphasizedAccelerate: { duration: 200, easing: 'cubic-bezier(0.3, 0, 0.8, 0.15)' },
    standard: { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    standardDecelerate: { duration: 250, easing: 'cubic-bezier(0, 0, 0, 1)' },
    standardAccelerate: { duration: 200, easing: 'cubic-bezier(0.3, 0, 1, 1)' },
    decelerate: { duration: 250, easing: 'cubic-bezier(0, 0, 0, 1)' },
    accelerate: { duration: 200, easing: 'cubic-bezier(0.3, 0, 1, 1)' },
    linear: { duration: 200, easing: 'linear' },
  },
  duration: {
    short1: 50,
    short2: 100,
    short3: 150,
    short4: 200,
    medium1: 250,
    medium2: 300,
    medium3: 350,
    medium4: 400,
    long1: 450,
    long2: 500,
    long3: 550,
    long4: 600,
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────
// MD3 · STATE LAYER (opacidades de hover/focus/pressed/dragged)
// ──────────────────────────────────────────────────────────────────────────
export const MD3_STATE_LAYER = {
  hover: 0.08,
  focus: 0.1,
  pressed: 0.12,
  dragged: 0.16,
} as const;

// ──────────────────────────────────────────────────────────────────────────
// SPACING (rejilla base 4dp)
// ──────────────────────────────────────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// Altura nominal de la NavigationBar MD3 (sin contar el safe-area inferior).
export const NAV_BAR_HEIGHT = 72;

// ──────────────────────────────────────────────────────────────────────────
// THEME OBJECT (light/dark)
// ──────────────────────────────────────────────────────────────────────────
export type AppTheme = {
  colors: ColorScheme;
  elevation: Record<string, Elevation>;
  radius: typeof MD3_RADIUS;
  type: Record<string, TypeStyle>;
  motion: typeof MD3_MOTION;
  stateLayer: typeof MD3_STATE_LAYER;
  spacing: typeof SPACING;
  navBarHeight: number;
  scheme: 'light' | 'dark';
};

const lightTheme: AppTheme = {
  colors: MD3_LIGHT,
  elevation: MD3_ELEVATION,
  radius: MD3_RADIUS,
  type: MD3_TYPE,
  motion: MD3_MOTION,
  stateLayer: MD3_STATE_LAYER,
  spacing: SPACING,
  navBarHeight: NAV_BAR_HEIGHT,
  scheme: 'light',
};

const darkTheme: AppTheme = {
  colors: MD3_DARK,
  elevation: MD3_ELEVATION,
  radius: MD3_RADIUS,
  type: MD3_TYPE,
  motion: MD3_MOTION,
  stateLayer: MD3_STATE_LAYER,
  spacing: SPACING,
  navBarHeight: NAV_BAR_HEIGHT,
  scheme: 'dark',
};

// ──────────────────────────────────────────────────────────────────────────
// THEME PROVIDER + HOOKS
// ──────────────────────────────────────────────────────────────────────────
type ThemeContextValue = {
  theme: AppTheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export type ThemeProviderProps = {
  mode?: ThemeMode;
  children: React.ReactNode;
};

/**
 * ThemeProvider — opcional. Sin provider, useAppTheme() usa el esquema del SO.
 * F3 lo integrará en App.tsx con mode controlado por useSettingsStore.
 */
export const ThemeProvider = ({ mode: modeProp, children }: ThemeProviderProps) => {
  const systemScheme = useColorScheme();
  const [modeState, setModeState] = useState<ThemeMode>(() => modeProp ?? getThemeMode());

  useEffect(() => {
    if (modeProp !== undefined) {
      setModeState(modeProp);
      return;
    }
    void loadThemeMode().then((m) => setModeState(m));
    const unsub = subscribeThemeMode((m) => setModeState(m));
    return unsub;
  }, [modeProp]);

  const resolvedMode: ThemeMode = modeState;
  const effectiveScheme: 'light' | 'dark' =
    resolvedMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : resolvedMode;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: effectiveScheme === 'dark' ? darkTheme : lightTheme,
      mode: resolvedMode,
      setMode: setThemeMode,
    }),
    [effectiveScheme, resolvedMode],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
};

/**
 * Hook principal para consumir tokens. Si no hay ThemeProvider, usa el esquema
 * del SO como fallback. Nunca devuelve undefined.
 */
export const useAppTheme = (): AppTheme => {
  const ctx = useContext(ThemeContext);
  const systemScheme = useColorScheme();
  if (ctx) return ctx.theme;
  return systemScheme === 'dark' ? darkTheme : lightTheme;
};

/**
 * Hook extendido: devuelve también el modo y setter (para SettingsMenu).
 */
export const useThemeController = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  const systemScheme = useColorScheme();
  const fallbackMode: ThemeMode = getThemeMode();
  if (ctx) return ctx;
  return {
    theme: systemScheme === 'dark' ? darkTheme : lightTheme,
    mode: fallbackMode,
    setMode: setThemeMode,
  };
};
