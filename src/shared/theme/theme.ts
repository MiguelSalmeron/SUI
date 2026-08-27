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
 *   - NUNCA uses colors.surface como color de TEXTO/ícono sobre fondos
 *     primary/secondary/flame/success. En dark, surface es casi negro →
 *     texto ilegible. Usa el token onX correspondiente (onPrimary,
 *     onSecondary, onFlame, onSuccess, onError).
 *   - NUNCA uses colors.primary como shadowColor → genera halos en dark.
 *     Usa theme.elevation.levelN vía createSurface().
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
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
  // Notificar tras hidratación: el primer render pudo usar el default
  // 'system' mientras AsyncStorage resolvía. Sin esto, la preferencia
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
  onFlame: string;
  flameContainer: string;
  onFlameContainer: string;
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
  // Azul pizarra: sereno y con suficiente presencia para acciones rápidas.
  primary: '#355F78',
  onPrimary: '#FFFFFF',
  primaryContainer: '#DCEAF1',
  onPrimaryContainer: '#132F3E',

  // Verde salvia: acompañamiento, progreso sostenido y estados positivos.
  secondary: '#55796F',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#DCEBE5',
  onSecondaryContainer: '#17352E',

  tertiary: '#746B83',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#ECE5F1',
  onTertiaryContainer: '#332B3D',

  background: '#F5F7F5',
  onBackground: '#202522',
  surface: '#FDFEFC',
  onSurface: '#202522',
  surfaceVariant: '#E1E7E3',
  onSurfaceVariant: '#59635E',
  surfaceContainer: '#EEF2EF',
  surfaceContainerHigh: '#E7ECE8',
  surfaceContainerHighest: '#DFE6E1',
  surfaceContainerLow: '#F4F7F5',
  surfaceContainerLowest: '#FFFFFF',

  outline: '#76817B',
  outlineVariant: '#D3DBD6',

  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  success: '#2E7D32',
  onSuccess: '#FFFFFF',
  successContainer: '#CFE9D2',
  onSuccessContainer: '#07250B',

  // Único acento energético; reservar para rachas y celebraciones.
  flame: '#E87536',
  onFlame: '#FFFFFF',
  flameContainer: '#FCE9DC',
  onFlameContainer: '#4A250F',
  flameOutline: '#F2C8AC',

  inverseSurface: '#2F3033',
  inverseOnSurface: '#F1F0F4',
  inversePrimary: '#A8CADC',

  scrim: 'rgba(0, 0, 0, 0.32)',
};

// ──────────────────────────────────────────────────────────────────────────
// MD3 · COLOR (dark scheme)
// ──────────────────────────────────────────────────────────────────────────
export const MD3_DARK: ColorScheme = {
  primary: '#A8CADC',
  onPrimary: '#143445',
  primaryContainer: '#294F64',
  onPrimaryContainer: '#DCEAF1',

  secondary: '#AACDC1',
  onSecondary: '#193B32',
  secondaryContainer: '#365A50',
  onSecondaryContainer: '#DCEBE5',

  tertiary: '#D0C3D9',
  onTertiary: '#3B3145',
  tertiaryContainer: '#52475E',
  onTertiaryContainer: '#ECE5F1',

  background: '#111613',
  onBackground: '#E2E8E4',
  surface: '#181E1A',
  onSurface: '#E2E8E4',
  surfaceVariant: '#414944',
  onSurfaceVariant: '#BDC7C1',
  surfaceContainer: '#1E2521',
  surfaceContainerHigh: '#28302B',
  surfaceContainerHighest: '#323B35',
  surfaceContainerLow: '#191F1B',
  surfaceContainerLowest: '#0F1411',

  outline: '#88948D',
  outlineVariant: '#414944',

  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  success: '#A6D6A9',
  onSuccess: '#0B3910',
  successContainer: '#1F5124',
  onSuccessContainer: '#CFE9D2',

  flame: '#FFB385',
  onFlame: '#3A1A00',
  flameContainer: '#4A2D1A',
  onFlameContainer: '#FFE0C7',
  flameOutline: '#6B4325',

  inverseSurface: '#E3E3E9',
  inverseOnSurface: '#2F3033',
  inversePrimary: '#355F78',

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
  shadowColor: string = '#000000',
): Elevation => ({
  shadowColor,
  shadowOffset: { width: 0, height },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation: elev,
});

/**
 * Elevación por esquema. En dark las sombras negras apenas se ven; subimos
 * opacidad y profundidad para mantener jerarquía sin halos de color.
 * NUNCA uses colors.primary como shadowColor: genera halos en dark mode.
 */
export const MD3_ELEVATION_LIGHT: Record<string, Elevation> = {
  level0: elevation(0, 0, 0, 0),
  level1: elevation(1, 0.05, 3, 1),
  level2: elevation(2, 0.08, 6, 3),
  level3: elevation(4, 0.1, 10, 6),
  level4: elevation(6, 0.12, 14, 8),
  level5: elevation(8, 0.14, 18, 12),
};

export const MD3_ELEVATION_DARK: Record<string, Elevation> = {
  level0: elevation(0, 0, 0, 0),
  level1: elevation(1, 0.25, 3, 2),
  level2: elevation(2, 0.3, 6, 4),
  level3: elevation(4, 0.35, 10, 7),
  level4: elevation(6, 0.4, 14, 9),
  level5: elevation(8, 0.45, 18, 12),
};

/** @deprecated Usa theme.elevation — se resuelve por scheme. */
export const MD3_ELEVATION = MD3_ELEVATION_LIGHT;

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
  displayLg: { fontSize: 52, lineHeight: 60, fontWeight: '800' },
  displayMd: { fontSize: 40, lineHeight: 48, fontWeight: '800' },
  displaySm: { fontSize: 32, lineHeight: 40, fontWeight: '800' },

  headlineLg: { fontSize: 30, lineHeight: 38, fontWeight: '700' },
  headlineMd: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  headlineSm: { fontSize: 22, lineHeight: 30, fontWeight: '700' },

  titleLg: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  titleMd: { fontSize: 16, lineHeight: 24, fontWeight: '600', letterSpacing: 0.1 },
  titleSm: { fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },

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

import { useSettingsStore } from '@/shared/preferences/useSettingsStore';

export const FONT_SCALE_MAP: Record<string, number> = {
  small: 0.88,
  medium: 1.0,
  large: 1.15,
};

const scaleTypography = (
  typeTokens: Record<string, TypeStyle>,
  scale: number,
): Record<string, TypeStyle> => {
  if (scale === 1.0) return typeTokens;
  const result: Record<string, TypeStyle> = {};
  for (const key in typeTokens) {
    const s = typeTokens[key];
    if (!s) continue;
    result[key] = {
      ...s,
      fontSize: Math.round(s.fontSize * scale),
      lineHeight: Math.round(s.lineHeight * scale),
    };
  }
  return result;
};

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
  fontScale: number;
};

const lightTheme: AppTheme = {
  colors: MD3_LIGHT,
  elevation: MD3_ELEVATION_LIGHT,
  radius: MD3_RADIUS,
  type: MD3_TYPE,
  motion: MD3_MOTION,
  stateLayer: MD3_STATE_LAYER,
  spacing: SPACING,
  navBarHeight: NAV_BAR_HEIGHT,
  scheme: 'light',
  fontScale: 1.0,
};

const darkTheme: AppTheme = {
  colors: MD3_DARK,
  elevation: MD3_ELEVATION_DARK,
  radius: MD3_RADIUS,
  type: MD3_TYPE,
  motion: MD3_MOTION,
  stateLayer: MD3_STATE_LAYER,
  spacing: SPACING,
  navBarHeight: NAV_BAR_HEIGHT,
  scheme: 'dark',
  fontScale: 1.0,
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
/**
 * ThemeProvider — usa useSyncExternalStore para sincronización garantizada
 * entre el mini-store externo (AsyncStorage cache) y el árbol de React.
 * Elimina cualquier race condition donde el modo persiste pero la UI no
 * re-renderiza.
 */
export const ThemeProvider = ({ mode: modeProp, children }: ThemeProviderProps) => {
  const systemScheme = useColorScheme();

  const modeState = useSyncExternalStore(
    subscribeThemeMode,
    () => (modeProp !== undefined ? modeProp : getThemeMode()),
  );

  const resolvedMode: ThemeMode = modeProp ?? modeState;
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
 * del SO como fallback. Aplica el escalado de tipografía según la preferencia.
 */
export const useAppTheme = (): AppTheme => {
  const ctx = useContext(ThemeContext);
  const systemScheme = useColorScheme();
  const fontSizeSetting = useSettingsStore((s) => s.fontSize);
  const fontScale = FONT_SCALE_MAP[fontSizeSetting] ?? 1.0;

  const rawTheme = ctx ? ctx.theme : systemScheme === 'dark' ? darkTheme : lightTheme;

  return useMemo(
    () => ({
      ...rawTheme,
      fontScale,
      type: scaleTypography(rawTheme.type, fontScale),
    }),
    [rawTheme, fontScale],
  );
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

// ──────────────────────────────────────────────────────────────────────────
// SURFACE PRESETS (aplicación consistente de elevation + container color)
// ──────────────────────────────────────────────────────────────────────────

export type SurfaceLevel = 'level0' | 'level1' | 'level2' | 'level3' | 'level4' | 'level5';

export type SurfaceStyle = Elevation & {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
};

/**
 * Crea estilos de superficie consistentes a partir del nivel de elevación.
 * - level0: sin sombra, surfaceContainerLowest, sin borde.
 * - level1: sutil, surfaceContainer, borde outlineVariant.
 * - level2: intermedia, surfaceContainer, borde outlineVariant (default cards).
 * - level3: destacada, surfaceContainerHigh, sin borde (sombra suficiente).
 * - level4/5: para overlays/modales prominentes.
 */
export const createSurface = (theme: AppTheme, level: SurfaceLevel = 'level1'): SurfaceStyle => {
  const { colors, elevation: elevationTokens } = theme;
  const elev = elevationTokens[level] ?? elevationTokens.level1;

  const bgByLevel: Record<SurfaceLevel, string> = {
    level0: colors.surfaceContainerLowest,
    level1: colors.surfaceContainer,
    level2: colors.surfaceContainer,
    level3: colors.surfaceContainerHigh,
    level4: colors.surfaceContainerHigh,
    level5: colors.surfaceContainerHighest,
  };

  const withBorder = level === 'level1' || level === 'level2';

  return {
    ...elev,
    backgroundColor: bgByLevel[level],
    borderColor: withBorder ? colors.outlineVariant : 'transparent',
    borderWidth: withBorder ? 1 : 0,
  };
};
