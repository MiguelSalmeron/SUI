/**
 * Contratos del espejo de Google Calendar (sólo lectura + espejo selectivo).
 *
 * Sui es la fuente de verdad. Google recibe sólo las entidades que el usuario
 * habilitó explícitamente.
 */

import type { Goal, Habit } from './productivity';
import { isPlannedTime } from './validation';

// ---------------------------------------------------------------------------
// Google Calendar Mirror Contracts (Fase 1: dominio local, sin escritura)
// Sui es fuente de verdad. Google es espejo selectivo de solo-lectura.
// ---------------------------------------------------------------------------
export type MirrorStatus = 'pending' | 'mirrored' | 'diverged' | 'error';
export type MirrorEntityType = 'goal' | 'habit';

export interface MirrorState {
  suiId: string;
  suiType: MirrorEntityType;
  googleCalendarId?: string;
  googleEventId?: string;
  lastMirroredAt?: string;
  status: MirrorStatus;
}

export interface MirrorPreferences {
  goalsEnabled: boolean;
  habitsEnabled: boolean;
}

export const DEFAULT_MIRROR_PREFS: MirrorPreferences = {
  goalsEnabled: true,
  habitsEnabled: false,
};

export const DEFAULT_GOAL_MIRROR = true as const;
export const DEFAULT_HABIT_MIRROR = false as const;

export const shouldMirrorGoal = (
  goal: Pick<Goal, 'deadline' | 'mirrorToGoogle'>,
  prefs: MirrorPreferences = DEFAULT_MIRROR_PREFS,
): boolean => {
  if (!prefs.goalsEnabled) return false;
  if (goal.mirrorToGoogle === false) return false;
  return typeof goal.deadline === 'string' && goal.deadline.length > 0;
};

export const shouldMirrorHabit = (
  habit: Pick<Habit, 'plannedTime' | 'mirrorToGoogle'>,
  prefs: MirrorPreferences = DEFAULT_MIRROR_PREFS,
): boolean => {
  if (!prefs.habitsEnabled) return false;
  if (habit.mirrorToGoogle !== true) return false;
  return isPlannedTime(habit.plannedTime);
};
