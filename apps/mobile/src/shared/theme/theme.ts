/**
 * Sistema de diseño SUI — Material Design v3 (Google).
 *
 * Este archivo es el punto de entrada público del tema: reexporta los tokens y
 * define el provider y los hooks. La implementación vive separada por
 * preocupación:
 *
 * - `colorScheme.ts`: colores semánticos claro/oscuro.
 * - `elevation.ts`: sombras por nivel y por esquema.
 * - `tokens.ts`: radios, movimiento, capas de estado y espaciado.
 * - `themeModeStore.ts`: preferencia light/dark/system persistida.
 * - `appTheme.ts`: objeto resuelto `AppTheme`, temas y superficies.
 * - `typography.ts`: escala tipográfica.
 *
 * Convenciones:
 *   - NUNCA uses colores hex hardcodeados fuera de estos archivos de tokens.
 *   - NUNCA importes MD3_LIGHT o MD3_DARK directamente desde componentes.
 *   - Usa useAppTheme() para tokens dinámicos.
 *   - NUNCA uses colors.surface como color de TEXTO/ícono sobre fondos
 *     primary/secondary/flame/success. En dark, surface es casi negro →
 *     texto ilegible. Usa el token onX correspondiente (onPrimary,
 *     onSecondary, onFlame, onSuccess, onError).
 *   - NUNCA uses colors.primary como shadowColor → genera halos en dark.
 *     Usa theme.elevation.levelN vía createSurface().
 */

import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/shared/preferences/useSettingsStore';
import { FONT_SCALE_MAP, scaleTypography } from './typography';
import { darkTheme, lightTheme, type AppTheme } from './appTheme';
import {
  getThemeMode,
  setThemeMode,
  subscribeThemeMode,
  type ThemeMode,
} from './themeModeStore';

export {
  FONT_SCALE_MAP,
  MD3_TYPE,
  TYPOGRAPHY,
  scaleTypography,
  type TypeStyle,
  type TypographyScale,
  type TypographyToken,
} from './typography';

export { type ColorScheme, MD3_LIGHT, MD3_DARK, MD3_COLORS } from './colorScheme';

export {
  type Elevation,
  MD3_ELEVATION_LIGHT,
  MD3_ELEVATION_DARK,
  MD3_ELEVATION,
} from './elevation';

export {
  MD3_RADIUS,
  MD3_MOTION,
  MD3_STATE_LAYER,
  SPACING,
  NAV_BAR_HEIGHT,
  SCREEN_CONTENT_BOTTOM_PADDING,
  SCREEN_MAX_CONTENT_WIDTH,
} from './tokens';

export {
  type ThemeMode,
  getThemeMode,
  setThemeMode,
  subscribeThemeMode,
} from './themeModeStore';

export {
  type AppTheme,
  type SurfaceLevel,
  type SurfaceStyle,
  createSurface,
} from './appTheme';

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
 * ThemeProvider — usa useSyncExternalStore para sincronización garantizada
 * entre el mini-store externo (AsyncStorage cache) y el árbol de React.
 * Elimina cualquier race condition donde el modo persiste pero la UI no
 * re-renderiza. Es opcional: sin provider, useAppTheme() usa el esquema del SO.
 */
export const ThemeProvider = ({ mode: modeProp, children }: ThemeProviderProps) => {
  const systemScheme = useColorScheme();

  const modeState = useSyncExternalStore(subscribeThemeMode, () =>
    modeProp !== undefined ? modeProp : getThemeMode(),
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
