import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useCelebrationStore } from '@/shared/domain/productivity/public';
import { recordTelemetry } from '@/shared/observability/telemetry';
import {
  cancelPomodoroCompleteNotification,
  schedulePomodoroCompleteNotification,
} from '../services/notifications';
import { usePomodoroStore } from '../store/usePomodoroStore';

/**
 * Motor del temporizador Pomodoro.
 *
 * El store es una máquina de estados pura; este hook orquesta los efectos:
 * tick de precisión mientras corre, reconciliación al volver de background
 * (o al montar), notificación local de fin (opt-in) y celebración/telemetría
 * al completar. El cierre del callback externo se estabiliza en un ref para
 * no re-suscribir timers en cada render del padre.
 */
export const usePomodoroEngine = (onSessionComplete?: () => void) => {
  const appState = useRef(AppState.currentState);
  const celebrate = useCelebrationStore((s) => s.trigger);

  const onCompleteRef = useRef(onSessionComplete);
  useEffect(() => {
    onCompleteRef.current = onSessionComplete;
  }, [onSessionComplete]);

  const running = usePomodoroStore((s) => s.running);
  const targetEndTime = usePomodoroStore((s) => s.targetEndTime);

  const handleComplete = useCallback(() => {
    const state = usePomodoroStore.getState();
    // Guarda idempotente: una sola transición por sesión.
    if (!state.running || !state.targetEndTime) return;
    state.completeSession();
    void cancelPomodoroCompleteNotification();
    celebrate({ kind: 'pomodoro' });
    recordTelemetry('pomodoro.completed');
    onCompleteRef.current?.();
  }, [celebrate]);

  const scheduleIfEnabled = useCallback(() => {
    const { notifyOnComplete, targetEndTime: end } = usePomodoroStore.getState();
    if (notifyOnComplete && end) {
      void schedulePomodoroCompleteNotification(end).catch(() => undefined);
    }
  }, []);

  const cancelPending = useCallback(() => {
    void cancelPomodoroCompleteNotification();
  }, []);

  const start = useCallback(() => {
    usePomodoroStore.getState().start();
    scheduleIfEnabled();
  }, [scheduleIfEnabled]);

  const pause = useCallback(() => {
    usePomodoroStore.getState().pause();
    cancelPending();
  }, [cancelPending]);

  const resume = useCallback(() => {
    usePomodoroStore.getState().resume();
    scheduleIfEnabled();
  }, [scheduleIfEnabled]);

  const reset = useCallback(() => {
    usePomodoroStore.getState().reset();
    cancelPending();
  }, [cancelPending]);

  // Tick más frecuente que 1s para precisión de borde; el store no
  // re-renderiza en exceso porque `syncRemaining` es un no-op sin cambio.
  useEffect(() => {
    if (!running || !targetEndTime) return;

    const intervalId = setInterval(() => {
      const remainingSeconds = Math.ceil((targetEndTime - Date.now()) / 1000);
      if (remainingSeconds <= 0) {
        clearInterval(intervalId);
        handleComplete();
      } else {
        usePomodoroStore.getState().syncRemaining(remainingSeconds);
      }
    }, 250);

    return () => clearInterval(intervalId);
  }, [running, targetEndTime, handleComplete]);

  // Reconciliación al montar (sesión sobrevivió un reinicio) y al volver
  // de background: si el objetivo ya venció se completa; si no, se recalcula.
  useEffect(() => {
    const reconcile = () => {
      const state = usePomodoroStore.getState();
      state.refreshDay();
      if (!state.running || !state.targetEndTime) return;
      const remainingSeconds = Math.ceil((state.targetEndTime - Date.now()) / 1000);
      if (remainingSeconds <= 0) {
        handleComplete();
      } else {
        state.syncRemaining(remainingSeconds);
      }
    };

    reconcile();

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      const previous = appState.current;
      appState.current = next;
      if (previous.match(/inactive|background/) && next === 'active') {
        reconcile();
      }
    });

    return () => subscription.remove();
  }, [handleComplete]);

  return { start, pause, resume, reset };
};
