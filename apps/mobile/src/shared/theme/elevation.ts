/**
 * Elevación MD3 — sombras suaves por nivel.
 *
 * En dark las sombras negras apenas se ven; subimos opacidad y profundidad
 * para mantener jerarquía sin halos de color. NUNCA uses colors.primary como
 * shadowColor: genera halos en dark mode.
 */

import { SUI_BRAND } from './brand';

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

export const MD3_ELEVATION_LIGHT: Record<string, Elevation> = {
  level0: elevation(0, 0, 0, 0),
  level1: elevation(1, 0.05, 3, 1),
  level2: elevation(2, 0.08, 6, 3),
  level3: elevation(4, 0.1, 10, 6),
  level4: elevation(6, 0.12, 14, 8),
  level5: elevation(8, 0.14, 18, 12),
  soft: elevation(4, 0.05, 18, 2, SUI_BRAND.navy),
  floating: elevation(4, 0.07, 20, 3, SUI_BRAND.navy),
};

export const MD3_ELEVATION_DARK: Record<string, Elevation> = {
  level0: elevation(0, 0, 0, 0),
  level1: elevation(1, 0.25, 3, 2),
  level2: elevation(2, 0.3, 6, 4),
  level3: elevation(4, 0.35, 10, 7),
  level4: elevation(6, 0.4, 14, 9),
  level5: elevation(8, 0.45, 18, 12),
  soft: elevation(0, 0, 0, 0),
  floating: elevation(0, 0, 0, 0),
};

/** @deprecated Usa theme.elevation — se resuelve por scheme. */
export const MD3_ELEVATION = MD3_ELEVATION_LIGHT;
