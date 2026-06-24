import AsyncStorage from '@react-native-async-storage/async-storage';

// Clave única del estado del tablero (compartida con HomeScreen).
export const HOME_STATE_KEY = 'sui-home-state-v4';

export interface HomeListItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface HomeState {
  goals: HomeListItem[];
  habits: HomeListItem[];
  pomodoroMinutes: number;
  pomodoroSessions: number;
  /** Fecha local (YYYY-MM-DD) del último reseteo diario del checklist. */
  lastResetDate?: string;
  /** Días consecutivos con al menos una meta/hábito cumplido. */
  streakCount?: number;
  /** Fecha local (YYYY-MM-DD) del último día que contó para la racha. */
  lastCompletedDate?: string;
}

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
  return (
    lastCompletedDate === localDateKey() ||
    lastCompletedDate === yesterdayKey()
  );
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

/** Devuelve una copia de los items con `completed` reiniciado a false. */
export const resetItemsCompletion = (items: HomeListItem[]): HomeListItem[] =>
  items.map((item) => ({ ...item, completed: false }));

export interface DailyResetResult {
  goals: HomeListItem[];
  habits: HomeListItem[];
  todayKey: string;
  /** true si se aplicó un reseteo (cambió el día desde el último guardado). */
  didReset: boolean;
}

/**
 * Aplica el reseteo diario del checklist: si `lastResetDate` no coincide con
 * el día local actual, marca todas las metas y hábitos como no completados.
 * Idempotente dentro del mismo día.
 */
export const applyDailyReset = (
  goals: HomeListItem[],
  habits: HomeListItem[],
  lastResetDate: string | undefined
): DailyResetResult => {
  const todayKey = localDateKey();
  if (lastResetDate === todayKey) {
    return { goals, habits, todayKey, didReset: false };
  }
  return {
    goals: resetItemsCompletion(goals),
    habits: resetItemsCompletion(habits),
    todayKey,
    didReset: true,
  };
};

const makeItem = (title: string, index: number): HomeListItem => ({
  id: `onboarding-${index}-${title.toLowerCase().replace(/\s+/g, '-')}`,
  title,
  completed: false,
});

/**
 * Siembra las metas elegidas en el onboarding dentro del estado local del
 * tablero, para que la selección guiada tenga efecto visible en Home.
 * Es idempotente: no duplica si ya existen metas guardadas.
 */
export const seedOnboardingGoals = async (goalLabels: string[]): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(HOME_STATE_KEY);
    const existing: Partial<HomeState> = raw ? JSON.parse(raw) : {};

    // Si el usuario ya tiene metas, no sobrescribimos su trabajo.
    if (existing.goals && existing.goals.length > 0) {
      return;
    }

    const merged: HomeState = {
      goals: goalLabels.map(makeItem),
      habits: existing.habits ?? [],
      pomodoroMinutes: existing.pomodoroMinutes ?? 25,
      pomodoroSessions: existing.pomodoroSessions ?? 0,
    };

    await AsyncStorage.setItem(HOME_STATE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.warn('No se pudieron sembrar las metas del onboarding:', error);
  }
};
