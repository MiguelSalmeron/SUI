import { isPlannedTime } from '@sui/contracts';
import { applyDailyReset, localDateKey, normalizeStreak } from '../model/homeStorage';
import { computeTotalXp, makeSnapshot, upsertSnapshot } from '../model/gamification';
import { getCurrentPreferences } from '@/shared/preferences/useSettingsStore';
import type { ProductivityData } from '../sync/syncTypes';
import type { ProductivityState } from './productivityState';

/**
 * Traducciones entre el estado del store y el modelo de dominio.
 *
 * Se separan del ensamblado del store porque las comparten la hidratación
 * local, el sync y el merge de nube: los tres necesitan la misma normalización
 * antes de escribir en el estado.
 */

export const toProductivityData = (state: ProductivityState): ProductivityData => ({
  goals: state.goals,
  habits: state.habits,
  lastResetDate: state.lastResetDate,
  streakCount: state.streak,
  lastCompletedDate: state.lastCompletedDate,
  weeklyHistory: state.weeklyHistory,
  totalXp: state.totalXp,
  preferences: getCurrentPreferences(),
});

/**
 * Repara datos que vienen de disco o de la nube antes de mostrarlos: aplica el
 * corte diario pendiente, rellena preferencias de mirror ausentes y recalcula
 * el XP cuando el guardado no lo trae explícito.
 */
export const normalizeLoadedData = (data: ProductivityData): ProductivityData => {
  let weeklyHistory = [...data.weeklyHistory];
  const todayKey = localDateKey();
  const goals = data.goals.map((goal) => ({
    ...goal,
    mirrorToGoogle: goal.mirrorToGoogle ?? true,
  }));
  const habits = data.habits.map((habit) => ({
    ...habit,
    plannedTime: isPlannedTime(habit.plannedTime) ? habit.plannedTime : undefined,
    mirrorToGoogle: habit.mirrorToGoogle ?? false,
  }));
  if (data.lastResetDate && data.lastResetDate !== todayKey) {
    weeklyHistory = upsertSnapshot(weeklyHistory, makeSnapshot(goals, habits, data.lastResetDate));
  }
  const reset = applyDailyReset(goals, habits, data.lastResetDate);
  weeklyHistory = upsertSnapshot(weeklyHistory, makeSnapshot(reset.goals, reset.habits, todayKey));
  const explicitXp = typeof data.totalXp === 'number' ? data.totalXp : 0;
  const totalXp = explicitXp > 0 ? explicitXp : computeTotalXp(weeklyHistory);
  return {
    ...data,
    goals: reset.goals,
    habits: reset.habits,
    lastResetDate: reset.todayKey,
    streakCount: normalizeStreak({
      streakCount: data.streakCount,
      lastCompletedDate: data.lastCompletedDate,
    }),
    weeklyHistory,
    totalXp,
  };
};

/** Traduce el modelo de dominio a los campos de datos del store. */
export const statePatch = (data: ProductivityData) => ({
  goals: data.goals,
  habits: data.habits,
  streak: data.streakCount,
  lastCompletedDate: data.lastCompletedDate,
  lastResetDate: data.lastResetDate,
  weeklyHistory: data.weeklyHistory,
  totalXp: data.totalXp,
});
