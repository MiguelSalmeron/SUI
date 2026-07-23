import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePomodoroStore } from '../store/usePomodoroStore';
import { useCelebrationStore } from '../store/useCelebrationStore';
import { notifyPomodoroCompleteNow } from '../services/notifications';

export const usePomodoroEngine = (onSessionComplete?: () => void) => {
  const appState = useRef(AppState.currentState);
  const celebrate = useCelebrationStore((s) => s.trigger);

  const handleComplete = useCallback(() => {
    celebrate({ kind: 'pomodoro', subtitle: '+25 XP · Toma un descanso' });
    void notifyPomodoroCompleteNow();
    onSessionComplete?.();
  }, [celebrate, onSessionComplete]);

  const {
    pomodoroRunning,
    targetEndTime,
    setPomodoroSeconds,
    completeSession,
  } = usePomodoroStore();

  useEffect(() => {
    if (!pomodoroRunning || !targetEndTime) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      const remainingSeconds = Math.ceil((targetEndTime - now) / 1000);

      if (remainingSeconds <= 0) {
        clearInterval(intervalId);
        completeSession();
        handleComplete();
      } else {
        setPomodoroSeconds(remainingSeconds);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [pomodoroRunning, targetEndTime, completeSession, setPomodoroSeconds, handleComplete]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const { pomodoroRunning: currentRunning, targetEndTime: currentTarget } =
          usePomodoroStore.getState();

        if (currentRunning && currentTarget) {
          const now = Date.now();
          const remainingSeconds = Math.ceil((currentTarget - now) / 1000);

          if (remainingSeconds <= 0) {
            usePomodoroStore.getState().completeSession();
            handleComplete();
          } else {
            usePomodoroStore.getState().setPomodoroSeconds(remainingSeconds);
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [handleComplete]);
};
