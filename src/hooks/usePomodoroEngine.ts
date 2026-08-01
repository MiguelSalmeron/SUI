import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePomodoroStore } from '../store/usePomodoroStore';
import { useCelebrationStore } from '../store/useCelebrationStore';
import { notifyPomodoroCompleteNow } from '../services/notifications';

export const usePomodoroEngine = (onSessionComplete?: () => void) => {
  const appState = useRef(AppState.currentState);
  const celebrate = useCelebrationStore((s) => s.trigger);

  // Estabiliza el callback externo en un ref para que los efectos del motor
  // no se re-suscriban en cada render del padre (evita timers fantasma).
  const onCompleteRef = useRef(onSessionComplete);
  useEffect(() => {
    onCompleteRef.current = onSessionComplete;
  }, [onSessionComplete]);

  const handleComplete = useCallback(() => {
    celebrate({ kind: 'pomodoro', subtitle: '+25 XP · Toma un descanso' });
    void notifyPomodoroCompleteNow();
    onCompleteRef.current?.();
  }, [celebrate]);

  const pomodoroRunning = usePomodoroStore((s) => s.pomodoroRunning);
  const targetEndTime = usePomodoroStore((s) => s.targetEndTime);

  useEffect(() => {
    if (!pomodoroRunning || !targetEndTime) return;

    // Tick más frecuente que 1s para precisión de borde y UI fluida; el costo
    // es mínimo porque el store está basado en refs y no re-renderiza en exceso.
    const intervalId = setInterval(() => {
      const now = Date.now();
      const remainingSeconds = Math.ceil((targetEndTime - now) / 1000);

      if (remainingSeconds <= 0) {
        clearInterval(intervalId);
        usePomodoroStore.getState().completeSession();
        handleComplete();
      } else {
        usePomodoroStore.getState().setPomodoroSeconds(remainingSeconds);
      }
    }, 250);

    return () => clearInterval(intervalId);
  }, [pomodoroRunning, targetEndTime, handleComplete]);

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
