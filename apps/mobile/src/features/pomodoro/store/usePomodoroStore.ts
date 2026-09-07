import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from '@/shared/domain/productivity/public';

export const POMODORO_STORAGE_KEY = '@sui/pomodoro-v1';
export const DEFAULT_POMODORO_MINUTES = 25;
export const POMODORO_MIN_MINUTES = 1;
export const POMODORO_MAX_MINUTES = 180;

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

  setMinutes: (minutes: number) => void;
  setNotifyOnComplete: (enabled: boolean) => void;
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

type PersistedPomodoro = Pick<
  PomodoroState,
  | 'minutes'
  | 'notifyOnComplete'
  | 'dayKey'
  | 'sessions'
  | 'focusMinutes'
  | 'running'
  | 'targetEndTime'
>;

const initialState = {
  minutes: DEFAULT_POMODORO_MINUTES,
  notifyOnComplete: false,
  secondsLeft: DEFAULT_POMODORO_MINUTES * 60,
  running: false,
  targetEndTime: null,
  ...emptyDay(),
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
      }),
      merge: (persisted, current) => {
        const base = {
          ...current,
          ...(persisted as Partial<PersistedPomodoro>),
          secondsLeft: current.secondsLeft,
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
