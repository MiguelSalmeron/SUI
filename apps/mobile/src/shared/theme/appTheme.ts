/**
 * Objeto de tema resuelto (claro/oscuro) y presets de superficie.
 *
 * `AppTheme` es lo que consume `useAppTheme()`. Los temas concretos se arman
 * aquí combinando esquema de color, elevación y tokens; los consumidores nunca
 * los importan directo, por eso no se reexportan desde `theme.ts`.
 */

import { MD3_LIGHT, MD3_DARK, type ColorScheme } from './colorScheme';
import { MD3_ELEVATION_LIGHT, MD3_ELEVATION_DARK, type Elevation } from './elevation';
import {
  MD3_RADIUS,
  MD3_MOTION,
  MD3_STATE_LAYER,
  SPACING,
  NAV_BAR_HEIGHT,
} from './tokens';
import { MD3_TYPE, type TypographyScale } from './typography';

export type AppTheme = {
  colors: ColorScheme;
  elevation: Record<string, Elevation>;
  radius: typeof MD3_RADIUS;
  type: TypographyScale;
  motion: typeof MD3_MOTION;
  stateLayer: typeof MD3_STATE_LAYER;
  spacing: typeof SPACING;
  navBarHeight: number;
  scheme: 'light' | 'dark';
  fontScale: number;
};

export const lightTheme: AppTheme = {
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

export const darkTheme: AppTheme = {
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
