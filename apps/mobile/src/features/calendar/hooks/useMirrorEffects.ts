import { useEffect, useMemo } from 'react';
import { appEventBus } from '@/shared/events/appEventBus';
import { useProductivityStore } from '@/shared/domain/productivity/public';
import { useSettingsStore } from '@/shared/preferences/useSettingsStore';
import type { MirrorPreferences } from '@sui/contracts';
import {
  collectMirrorCandidates,
  enqueueMirror,
  flushMirrorQueue,
  pruneMirrorQueue,
} from '../services/mirrorService';

/**
 * Efectos de espejo Sui -> Google (web y app).
 * - Al abrir calendario con datos cargados: encola candidatos y procesa.
 * - Al completar meta/hábito: re-encola ese item (marca ✓ en Google).
 * - Al apagar una categoría en Settings: poda sus upserts pendientes
 *   (los deletes siempre se procesan).
 * Sin background tasks: si falla (offline/401/429), la cola persiste en
 * AsyncStorage y se reintenta en la próxima apertura.
 */
export const useMirrorEffects = (connected: boolean): void => {
  const mirrorGoalsEnabled = useSettingsStore((s) => s.mirrorGoalsEnabled);
  const mirrorHabitsEnabled = useSettingsStore((s) => s.mirrorHabitsEnabled);
  const prefs: MirrorPreferences = useMemo(
    () => ({ goalsEnabled: mirrorGoalsEnabled, habitsEnabled: mirrorHabitsEnabled }),
    [mirrorGoalsEnabled, mirrorHabitsEnabled],
  );

  useEffect(() => {
    if (!connected) return;
    const state = useProductivityStore.getState();
    if (!state.stateLoaded) return;
    void (async () => {
      for (const job of collectMirrorCandidates(state.goals, state.habits, prefs)) {
        await enqueueMirror(job);
      }
      await flushMirrorQueue();
    })();
  }, [connected, prefs]);

  useEffect(() => {
    // Poda reactiva: al apagar categoría, sus upserts pendientes no deben espejarse.
    void pruneMirrorQueue(
      (job) =>
        job.operation === 'upsert' &&
        ((job.suiType === 'goal' && !prefs.goalsEnabled) ||
          (job.suiType === 'habit' && !prefs.habitsEnabled)),
    );
  }, [prefs]);

  useEffect(() => {
    if (!connected) return;
    const offGoal = appEventBus.on('productivity.goalCompleted', ({ goalId }) => {
      if (!prefs.goalsEnabled) return;
      void (async () => {
        await enqueueMirror({ suiId: goalId, suiType: 'goal', operation: 'upsert' });
        await flushMirrorQueue();
      })();
    });
    const offHabit = appEventBus.on('productivity.habitCompleted', ({ habitId }) => {
      if (!prefs.habitsEnabled) return;
      void (async () => {
        await enqueueMirror({ suiId: habitId, suiType: 'habit', operation: 'upsert' });
        await flushMirrorQueue();
      })();
    });
    return () => {
      offGoal();
      offHabit();
    };
  }, [connected, prefs]);
};
