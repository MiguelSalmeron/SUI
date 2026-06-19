import { create } from 'zustand';

export const DEFAULT_POMODORO_MINUTES = 25;

interface PomodoroState {
  pomodoroMinutes: number;
  pomodoroSessions: number;
  pomodoroSeconds: number;
  pomodoroRunning: boolean;
  pomodoroFullscreen: boolean;
  targetEndTime: number | null;
  
  // Actions
  setPomodoroMinutes: (minutes: number) => void;
  setPomodoroSessions: (sessions: number | ((prev: number) => number)) => void;
  setPomodoroSeconds: (seconds: number | ((prev: number) => number)) => void;
  setPomodoroRunning: (isRunning: boolean) => void;
  setPomodoroFullscreen: (isFullscreen: boolean) => void;
  setTargetEndTime: (time: number | null) => void;
  
  // High-level Actions
  startPomodoro: () => void;
  pausePomodoro: () => void;
  resetPomodoro: () => void;
  completeSession: () => void;
  initFromStorage: (minutes: number, sessions: number) => void;
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  pomodoroMinutes: DEFAULT_POMODORO_MINUTES,
  pomodoroSessions: 0,
  pomodoroSeconds: DEFAULT_POMODORO_MINUTES * 60,
  pomodoroRunning: false,
  pomodoroFullscreen: false,
  targetEndTime: null,

  setPomodoroMinutes: (minutes) => set({ pomodoroMinutes: minutes }),
  
  setPomodoroSessions: (updater) => set((state) => ({ 
    pomodoroSessions: typeof updater === 'function' ? updater(state.pomodoroSessions) : updater 
  })),
  
  setPomodoroSeconds: (updater) => set((state) => ({ 
    pomodoroSeconds: typeof updater === 'function' ? updater(state.pomodoroSeconds) : updater 
  })),
  
  setPomodoroRunning: (isRunning) => set({ pomodoroRunning: isRunning }),
  
  setPomodoroFullscreen: (isFullscreen) => set({ pomodoroFullscreen: isFullscreen }),
  
  setTargetEndTime: (time) => set({ targetEndTime: time }),

  startPomodoro: () => {
    const { pomodoroSeconds, pomodoroMinutes } = get();
    const activeSeconds = pomodoroSeconds === 0 ? pomodoroMinutes * 60 : pomodoroSeconds;
    
    set({
      pomodoroSeconds: activeSeconds,
      targetEndTime: Date.now() + activeSeconds * 1000,
      pomodoroRunning: true,
      pomodoroFullscreen: true,
    });
  },

  pausePomodoro: () => {
    set({
      pomodoroRunning: false,
      targetEndTime: null, // Wipe target so it stops calculating
    });
  },

  resetPomodoro: () => {
    const { pomodoroMinutes } = get();
    set({
      pomodoroRunning: false,
      pomodoroFullscreen: false,
      pomodoroSeconds: pomodoroMinutes * 60,
      targetEndTime: null,
    });
  },

  completeSession: () => {
    set((state) => ({
      pomodoroRunning: false,
      pomodoroFullscreen: false,
      pomodoroSeconds: 0,
      targetEndTime: null,
      pomodoroSessions: state.pomodoroSessions + 1,
    }));
  },

  initFromStorage: (minutes, sessions) => {
    set((state) => {
      // Don't reset active timer if hydrating
      if (state.pomodoroRunning) return {};
      
      return {
        pomodoroMinutes: minutes,
        pomodoroSessions: sessions,
        pomodoroSeconds: minutes * 60,
      };
    });
  },
}));
