import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from '@/shared/domain/productivity/pure';
import type { FocusDay, FocusTarget } from '@/shared/focus/focusTypes';

export const POMODORO_STORAGE_KEY = '@sui/pomodoro-v1';
export const DEFAULT_POMODORO_MINUTES = 25;
export const POMODORO_MIN_MINUTES = 1;
export const POMODORO_MAX_MINUTES = 180;
const MAX_FOCUS_HISTORY_DAYS = 14;

const clampMinutes = (minutes: number): number =>
  Math.min(POMODORO_MAX_MINUTES, Math.max(POMODORO_MIN_MINUTES, Math.round(minutes)));

interface PomodoroState {
  /** Duración configurada de la sesión. */
  minutes: number;
  /** Notificar al terminar la sesión (opt-in explícito). */
  notifyOnComplete: boolean;
  /** Segundos restantes de la sesión actual (sólo memoria, no se persiste). */
  secondsLeft: number;
  running: boolean;
  /** Instante absoluto de fin; permite reconciliar en background/reinicio. */
  targetEndTime: number | null;
  /** Estadísticas del día actual (se reinician al cambiar de fecha). */
  dayKey: string;
  sessions: number;
  focusMinutes: number;
  /** Qué estás avanzando; nulo si la sesión es libre. Se persiste para sobrevivir reinicios. */
  focusTarget: FocusTarget | null;
  /** Historial por día con tope; no se sincroniza, sólo lectura local. */
  history: FocusDay[];

  setMinutes: (minutes: number) => void;
  setNotifyOnComplete: (enabled: boolean) => void;
  /** Fija el objetivo de enfoque; pasar nulo lo deja como sesión libre. */
  setFocusTarget: (target: FocusTarget | null) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  /** Marca la sesión actual como completada. Idempotente: sólo una vez por sesión. */
  completeSession: () => void;
  /** Actualiza el contador visible desde el motor (tick de precisión). */
  syncRemaining: (seconds: number) => void;
  /** Normaliza las estadísticas al día actual (rollover de medianoche). */
  refreshDay: () => void;
}

const emptyDay = () => ({
  dayKey: localDateKey(),
  sessions: 0,
  focusMinutes: 0,
});

// Acá se suma la sesión al día de hoy dentro del historial: si ya existe la
// entrada se acumula, si no se crea. Se ordena por día y se recorta al tope
// para que el arreglo nunca crezca sin control en el teléfono.
const upsertFocusDay = (history: FocusDay[], dayKey: string, minutes: number): FocusDay[] => {
  const next = [...history];
  const at = next.findIndex((entry) => entry.dayKey === dayKey);
  if (at >= 0) {
    const current = next[at]!;
    next[at] = {
      dayKey,
      sessions: current.sessions + 1,
      minutes: current.minutes + minutes,
    };
  } else {
    next.push({ dayKey, sessions: 1, minutes });
  }
  next.sort((a, b) => (a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0));
  return next.slice(-MAX_FOCUS_HISTORY_DAYS);
};

// Fijate que el disco puede traer cualquier cosa (payload viejo o corrupto):
// se acepta sólo lo que tiene forma válida y lo demás se descarta sin reventar.
const sanitizeFocusTarget = (value: unknown): FocusTarget | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate['kind'] === 'milestone') {
    if (typeof candidate['goalId'] === 'string' && typeof candidate['milestoneId'] === 'string') {
      return { kind: 'milestone', goalId: candidate['goalId'], milestoneId: candidate['milestoneId'] };
    }
    return null;
  }
  if (candidate['kind'] === 'habit') {
    if (typeof candidate['habitId'] === 'string') {
      return { kind: 'habit', habitId: candidate['habitId'] };
    }
    return null;
  }
  if (candidate['kind'] === 'goal') {
    if (typeof candidate['goalId'] === 'string') {
      return { kind: 'goal', goalId: candidate['goalId'] };
    }
    return null;
  }
  return null;
};

const sanitizeFocusHistory = (value: unknown): FocusDay[] => {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .filter(
      (entry): entry is FocusDay =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as FocusDay).dayKey === 'string' &&
        (entry as FocusDay).dayKey.length > 0 &&
        typeof (entry as FocusDay).sessions === 'number' &&
        Number.isFinite((entry as FocusDay).sessions) &&
        (entry as FocusDay).sessions >= 0 &&
        typeof (entry as FocusDay).minutes === 'number' &&
        Number.isFinite((entry as FocusDay).minutes) &&
        (entry as FocusDay).minutes >= 0,
    )
    .map((entry) => ({
      dayKey: entry.dayKey,
      sessions: Math.floor(entry.sessions),
      minutes: Math.floor(entry.minutes),
    }));
  cleaned.sort((a, b) => (a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0));
  return cleaned.slice(-MAX_FOCUS_HISTORY_DAYS);
};

type PersistedPomodoro = Pick<
  PomodoroState,
  | 'minutes'
  | 'notifyOnComplete'
  | 'dayKey'
  | 'sessions'
  | 'focusMinutes'
  | 'running'
  | 'targetEndTime'
  | 'focusTarget'
  | 'history'
>;

const initialState = {
  minutes: DEFAULT_POMODORO_MINUTES,
  notifyOnComplete: false,
  secondsLeft: DEFAULT_POMODORO_MINUTES * 60,
  running: false,
  targetEndTime: null,
  ...emptyDay(),
  focusTarget: null as FocusTarget | null,
  history: [] as FocusDay[],
};

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set) => ({
      ...initialState,

      setMinutes: (minutes) =>
        set((state) => {
          const clamped = clampMinutes(minutes);
          return {
            minutes: clamped,
            // Si hay una sesión en curso no se altera su cuenta regresiva.
            secondsLeft: state.running ? state.secondsLeft : clamped * 60,
          };
        }),

      setNotifyOnComplete: (enabled) => set({ notifyOnComplete: enabled }),

      setFocusTarget: (target) => set({ focusTarget: target }),

      start: () =>
        set((state) => {
          if (state.running) return state;
          const activeSeconds = state.secondsLeft <= 0 ? state.minutes * 60 : state.secondsLeft;
          return {
            secondsLeft: activeSeconds,
            running: true,
            targetEndTime: Date.now() + activeSeconds * 1000,
          };
        }),

      pause: () =>
        set((state) => {
          if (!state.running) return state;
          return { running: false, targetEndTime: null };
        }),

      resume: () =>
        set((state) => {
          if (state.running) return state;
          const activeSeconds = state.secondsLeft <= 0 ? state.minutes * 60 : state.secondsLeft;
          return {
            secondsLeft: activeSeconds,
            running: true,
            targetEndTime: Date.now() + activeSeconds * 1000,
          };
        }),

      reset: () =>
        set((state) => ({
          running: false,
          targetEndTime: null,
          secondsLeft: state.minutes * 60,
        })),

      completeSession: () =>
        set((state) => {
          if (!state.running) return state;
          const today = localDateKey();
          const stats = state.dayKey === today ? state : emptyDay();
          return {
            running: false,
            targetEndTime: null,
            secondsLeft: 0,
            dayKey: stats.dayKey,
            sessions: stats.sessions + 1,
            focusMinutes: stats.focusMinutes + state.minutes,
            // El historial se acumula acá mismo para que cerrar la app a media
            // sesión no pierda el día: al completar ya queda guardado.
            history: upsertFocusDay(state.history ?? [], today, state.minutes),
          };
        }),

      syncRemaining: (seconds) =>
        set((state) => {
          const next = Math.max(0, Math.round(seconds));
          if (state.secondsLeft === next) return state;
          return { secondsLeft: next };
        }),

      refreshDay: () =>
        set((state) => {
          if (state.dayKey === localDateKey()) return state;
          // El historial se conserva a propósito: sólo se reinician los
          // contadores de hoy, los días pasados quedan para Semana.
          return emptyDay();
        }),
    }),
    {
      name: POMODORO_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state): PersistedPomodoro => ({
        minutes: state.minutes,
        notifyOnComplete: state.notifyOnComplete,
        dayKey: state.dayKey,
        sessions: state.sessions,
        focusMinutes: state.focusMinutes,
        running: state.running,
        targetEndTime: state.targetEndTime,
        focusTarget: state.focusTarget,
        history: state.history,
      }),
      merge: (persisted, current) => {
        const raw = (persisted as Partial<PersistedPomodoro> | undefined) ?? {};
        const base = {
          ...current,
          ...raw,
          secondsLeft: current.secondsLeft,
          // Payload viejo sin estos campos hidrata sin errores.
          focusTarget: sanitizeFocusTarget(raw.focusTarget),
          history: sanitizeFocusHistory(raw.history),
        };
        // Rollover de medianoche: estadísticas de ayer no se arrastran.
        if (base.dayKey !== localDateKey()) {
          base.dayKey = localDateKey();
          base.sessions = 0;
          base.focusMinutes = 0;
        }
        if (base.running && typeof base.targetEndTime !== 'number') {
          base.running = false;
        }
        base.secondsLeft = base.running
          ? Math.max(0, Math.ceil((base.targetEndTime! - Date.now()) / 1000))
          : base.minutes * 60;
        return base;
      },
    },
  ),
);

// Selector de sólo lectura para Semana: expone el historial sin acciones de
// escritura, así D no toca el store de Pomodoro.
export const useFocusHistory = (): FocusDay[] => usePomodoroStore((s) => s.history);
