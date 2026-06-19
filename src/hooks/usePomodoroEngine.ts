import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePomodoroStore } from '../store/usePomodoroStore';

export const usePomodoroEngine = (onSessionComplete?: () => void) => {
  const appState = useRef(AppState.currentState);
  const {
    pomodoroRunning,
    targetEndTime,
    setPomodoroSeconds,
    completeSession,
  } = usePomodoroStore();

  // Engine for active ticking
  useEffect(() => {
    if (!pomodoroRunning || !targetEndTime) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      const remainingSeconds = Math.ceil((targetEndTime - now) / 1000);

      if (remainingSeconds <= 0) {
        clearInterval(intervalId);
        completeSession();
        if (onSessionComplete) {
          onSessionComplete();
        }
      } else {
        setPomodoroSeconds(remainingSeconds);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [pomodoroRunning, targetEndTime, completeSession, setPomodoroSeconds, onSessionComplete]);

  // AppState Listener for background -> foreground sync
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground!
        const { pomodoroRunning: currentRunning, targetEndTime: currentTarget } = usePomodoroStore.getState();
        
        if (currentRunning && currentTarget) {
          const now = Date.now();
          const remainingSeconds = Math.ceil((currentTarget - now) / 1000);
          
          if (remainingSeconds <= 0) {
             usePomodoroStore.getState().completeSession();
             if (onSessionComplete) {
               onSessionComplete();
             }
          } else {
             usePomodoroStore.getState().setPomodoroSeconds(remainingSeconds);
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [onSessionComplete]);
};
