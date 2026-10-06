/**
 * Esquemas de color MD3 de SUI (claro y oscuro).
 *
 * Acá viven los colores semánticos del sistema. Los componentes no deben
 * importar estos objetos directo: piden tokens a `useAppTheme()`. Se conserva
 * `MD3_COLORS` como alias legacy mientras dura la migración a F3.
 */

import { SUI_BRAND } from './brand';

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
  heroSurface: string;
  onHeroSurface: string;
  onHeroSurfaceVariant: string;
  heroDivider: string;
  heroGlowBlue: string;
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
  // Azul de acción oscurecido: conserva la marca y alcanza AA con blanco.
  primary: SUI_BRAND.actionBlue,
  onPrimary: '#FFFFFF',
  primaryContainer: '#D9EEF8',
  onPrimaryContainer: '#0B344A',

  // Verde salvia: acompañamiento, progreso sostenido y estados positivos.
  secondary: SUI_BRAND.sage,
  onSecondary: '#FFFFFF',
  secondaryContainer: '#DCEBE5',
  onSecondaryContainer: '#17352E',

  tertiary: '#596B86',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#E2EAF5',
  onTertiaryContainer: '#1C2A40',

  background: '#F5F1EA',
  onBackground: SUI_BRAND.navy,
  heroSurface: SUI_BRAND.navy,
  onHeroSurface: '#F5F8FA',
  onHeroSurfaceVariant: 'rgba(245,248,250,0.72)',
  heroDivider: 'rgba(255,255,255,0.12)',
  heroGlowBlue: SUI_BRAND.blue,
  surface: '#FFFFFF',
  onSurface: SUI_BRAND.navy,
  surfaceVariant: '#E3EDF2',
  onSurfaceVariant: '#516473',
  surfaceContainer: '#EEF5F8',
  surfaceContainerHigh: '#E6F0F4',
  surfaceContainerHighest: '#DCE9EF',
  surfaceContainerLow: '#F5F9FB',
  surfaceContainerLowest: '#FFFFFF',

  outline: '#607786',
  outlineVariant: '#CAD9E0',

  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  success: '#2E7D32',
  onSuccess: '#FFFFFF',
  successContainer: '#CFE9D2',
  onSuccessContainer: '#07250B',

  // Acento energético para foco, acción principal y racha.
  flame: SUI_BRAND.flame,
  onFlame: SUI_BRAND.navy,
  flameContainer: '#FCE9DC',
  onFlameContainer: '#4A250F',
  flameOutline: '#F2C8AC',

  inverseSurface: SUI_BRAND.navy,
  inverseOnSurface: '#F5F8FA',
  inversePrimary: '#62C4F2',

  scrim: 'rgba(0, 0, 0, 0.32)',
};

// ──────────────────────────────────────────────────────────────────────────
// MD3 · COLOR (dark scheme)
// ──────────────────────────────────────────────────────────────────────────
export const MD3_DARK: ColorScheme = {
  primary: '#62C4F2',
  onPrimary: '#06283A',
  primaryContainer: '#174D69',
  onPrimaryContainer: '#D9EEF8',

  secondary: '#AACDC1',
  onSecondary: '#193B32',
  secondaryContainer: '#365A50',
  onSecondaryContainer: '#DCEBE5',

  tertiary: '#BDC9E5',
  onTertiary: '#24324A',
  tertiaryContainer: '#3A4966',
  onTertiaryContainer: '#E2EAF5',

  background: SUI_BRAND.navy,
  onBackground: '#F5F8FA',
  heroSurface: '#174D69',
  onHeroSurface: '#F5F8FA',
  onHeroSurfaceVariant: 'rgba(245,248,250,0.75)',
  heroDivider: 'rgba(255,255,255,0.14)',
  heroGlowBlue: SUI_BRAND.blue,
  surface: '#111C32',
  onSurface: '#F5F8FA',
  surfaceVariant: '#2B3A55',
  onSurfaceVariant: '#C1CED8',
  surfaceContainer: '#16233D',
  surfaceContainerHigh: '#1C2C49',
  surfaceContainerHighest: '#243654',
  surfaceContainerLow: '#101A2F',
  surfaceContainerLowest: '#081023',

  outline: '#91A6B5',
  outlineVariant: '#344861',

  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  success: '#A6D6A9',
  onSuccess: '#0B3910',
  successContainer: '#1F5124',
  onSuccessContainer: '#CFE9D2',

  flame: '#FFB078',
  onFlame: SUI_BRAND.navy,
  flameContainer: '#4A2D1A',
  onFlameContainer: '#FFE0C7',
  flameOutline: '#6B4325',

  inverseSurface: '#E3E3E9',
  inverseOnSurface: '#2F3033',
  inversePrimary: SUI_BRAND.actionBlue,

  scrim: 'rgba(0, 0, 0, 0.55)',
};

/**
 * Alias temporal — los componentes legacy referencian `MD3_COLORS.primary`
 * directamente. En F3 cada componente se refactorizará a `useAppTheme().colors`.
 * Por ahora, MD3_COLORS apunta al esquema light como default.
 */
export const MD3_COLORS = MD3_LIGHT;
