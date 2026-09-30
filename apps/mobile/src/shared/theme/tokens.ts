/**
 * Tokens MD3 no cromáticos: radios, movimiento, capas de estado y espaciado.
 *
 * Se mantienen juntos porque son escalas puras sin dependencias entre sí ni de
 * los esquemas de color. `theme.ts` los reexpone para no cambiar los imports.
 */

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
  /**
   * Indicadores indeterminados: repiten hasta que termina el trabajo real.
   * No son duraciones de transición, por eso no viven en `duration`.
   */
  indeterminate: {
    /** Vuelta completa del indicador de carga (`SuiLoader`). */
    rotate: 1100,
    /** Ciclo de brillo del esqueleto (`Skeleton`). */
    shimmer: 800,
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

// Espacio final uniforme para listas; la barra de tabs vive fuera del scene.
export const SCREEN_CONTENT_BOTTOM_PADDING = SPACING.xl + SPACING.lg;

export const SCREEN_MAX_CONTENT_WIDTH = 560;
