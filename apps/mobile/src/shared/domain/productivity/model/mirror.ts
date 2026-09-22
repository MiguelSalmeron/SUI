import {
  DEFAULT_MIRROR_PREFS,
  shouldMirrorGoal as contractShouldMirrorGoal,
  shouldMirrorHabit as contractShouldMirrorHabit,
  type Goal,
  type Habit,
  type MirrorPreferences,
} from '@sui/contracts';

export type { MirrorPreferences, MirrorState, MirrorStatus, MirrorEntityType } from '@sui/contracts';
export { DEFAULT_MIRROR_PREFS, DEFAULT_GOAL_MIRROR, DEFAULT_HABIT_MIRROR } from '@sui/contracts';

/**
 * Regla pura Fase 1: decide si un item Sui debe espejarse en Google.
 * Sin I/O, sin fechas externas. Sui es fuente de verdad.
 */
export const shouldMirrorGoal = (
  goal: Pick<Goal, 'deadline' | 'mirrorToGoogle'>,
  prefs: MirrorPreferences = DEFAULT_MIRROR_PREFS,
): boolean => contractShouldMirrorGoal(goal, prefs);

export const shouldMirrorHabit = (
  habit: Pick<Habit, 'plannedTime' | 'mirrorToGoogle'>,
  prefs: MirrorPreferences = DEFAULT_MIRROR_PREFS,
): boolean => contractShouldMirrorHabit(habit, prefs);
