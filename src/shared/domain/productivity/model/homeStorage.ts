import type { Goal, Habit, DayOfWeek } from '@/shared/types/models';

// Clave única del estado del tablero.
export const HOME_STATE_KEY = 'sui-home-state-v6';

/**
 * Clave de fecha local en formato estable YYYY-MM-DD.
 * Usa la zona horaria del dispositivo (no UTC) para que el "día" coincida
 * con la medianoche local del estudiante.
 */
export const localDateKey = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Clave local del día anterior. Usa aritmética de fecha nativa (no UTC). */
export const yesterdayKey = (date: Date = new Date()): string => {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  return localDateKey(prev);
};

/** Mapea JavaScript getDay() (0=Dom, 1=Lun...) a DayOfWeek. */
export const getDayOfWeekKey = (date: Date = new Date()): DayOfWeek => {
  const days: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[date.getDay()];
};

/** Comprueba si un hábito corresponde al día de hoy según su frecuencia. */
export const isHabitDueToday = (habit: Habit, date: Date = new Date()): boolean => {
  if (habit.frequency === 'daily') return true;
  if (Array.isArray(habit.frequency)) {
    const todayKey = getDayOfWeekKey(date);
    return habit.frequency.includes(todayKey);
  }
  return true;
};

export interface StreakState {
  streakCount: number;
  lastCompletedDate?: string;
}

/**
 * Una racha sigue "viva" si el último día contado es hoy o ayer.
 * Si es más antiguo, se rompió (al usuario le falta un día completo).
 */
export const isStreakAlive = (lastCompletedDate?: string): boolean => {
  if (!lastCompletedDate) return false;
  return lastCompletedDate === localDateKey() || lastCompletedDate === yesterdayKey();
};

/**
 * Racha a mostrar al cargar: si se rompió, devuelve 0 (pero conservamos
 * `lastCompletedDate` como historial). Idempotente.
 */
export const normalizeStreak = (s: StreakState): number =>
  isStreakAlive(s.lastCompletedDate) ? s.streakCount : 0;

/**
 * Avanza la racha cuando el usuario cumple algo HOY:
 *  - Ya contado hoy → sin cambios.
 *  - Último día = ayer → +1 (continúa).
 *  - Sin historial o con hueco → reinicia a 1.
 */
export const advanceStreak = (s: StreakState): StreakState => {
  const today = localDateKey();
  if (s.lastCompletedDate === today) return s;
  const continues = s.lastCompletedDate === yesterdayKey();
  const base = isStreakAlive(s.lastCompletedDate) ? s.streakCount : 0;
  return {
    streakCount: continues ? base + 1 : 1,
    lastCompletedDate: today,
  };
};

/** Devuelve una copia de los hábitos con `completed` reiniciado a false para el nuevo día. */
export const resetHabitsCompletion = (habits: Habit[]): Habit[] =>
  habits.map((h) => ({ ...h, completed: false }));

export interface DailyResetResult {
  goals: Goal[];
  habits: Habit[];
  todayKey: string;
  /** true si se aplicó un reseteo (cambió el día desde el último guardado). */
  didReset: boolean;
}

/**
 * Aplica el reseteo diario del checklist de hábitos.
 * Las Metas NO se reinician ya que son proyectos con fecha límite e hitos.
 */
export const applyDailyReset = (
  goals: Goal[],
  habits: Habit[],
  lastResetDate: string | undefined,
): DailyResetResult => {
  const todayKey = localDateKey();
  if (lastResetDate === todayKey) {
    return { goals, habits, todayKey, didReset: false };
  }
  return {
    goals,
    habits: resetHabitsCompletion(habits),
    todayKey,
    didReset: true,
  };
};
