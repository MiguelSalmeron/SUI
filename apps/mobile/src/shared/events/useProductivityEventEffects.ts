import { useEffect } from 'react';
import { useI18n } from '@/shared/i18n/i18n';
import { useIntroStore } from '@/shared/account/useIntroStore';
import { recordTelemetry } from '@/shared/observability/telemetry';
import { useCelebrationStore, useProductivityStore } from '@/shared/domain/productivity/public';
import { appEventBus } from './appEventBus';

export const useProductivityEventEffects = (): void => {
  const { t } = useI18n();

  useEffect(() => {
    const offGoal = appEventBus.on('productivity.goalCompleted', ({ goalId }) => {
      const goal = useProductivityStore.getState().goals.find((item) => item.id === goalId);
      useCelebrationStore.getState().trigger({
        kind: 'goal',
        subtitle: goal ? t('home.goalCompleted') : undefined,
      });
      recordTelemetry('productivity.completed', { entity: 'goal' });
    });
    const offHabit = appEventBus.on('productivity.habitCompleted', ({ habitId }) => {
      const state = useProductivityStore.getState();
      const habit = state.habits.find((item) => item.id === habitId);
      const goal = state.goals.find((item) => item.id === habit?.linkedGoalId);
      useCelebrationStore.getState().trigger({
        kind: 'habit',
        subtitle: goal
          ? t('celebration.habitGoalXp', { title: goal.title })
          : habit
            ? t('celebration.habitXp', { title: habit.title })
            : undefined,
      });
      recordTelemetry('productivity.completed', { entity: 'habit' });
    });
    const offMilestone = appEventBus.on(
      'productivity.milestoneCompleted',
      ({ goalId, milestoneId }) => {
        const milestone = useProductivityStore
          .getState()
          .goals.find((item) => item.id === goalId)
          ?.milestones.find((item) => item.id === milestoneId);
        useCelebrationStore.getState().trigger({
          kind: 'goal',
          subtitle: milestone ? t('goals.milestoneDone', { title: milestone.title }) : undefined,
        });
        recordTelemetry('productivity.completed', { entity: 'milestone' });
      },
    );
    const offPerfectDay = appEventBus.on('productivity.perfectDayReached', () => {
      useCelebrationStore.getState().trigger({
        kind: 'perfect_day',
        subtitle: t('celebration.perfectBody'),
      });
      recordTelemetry('productivity.completed', { entity: 'perfect_day' });
    });
    return () => {
      offGoal();
      offHabit();
      offMilestone();
      offPerfectDay();
    };
  }, [t]);
};

/**
 * Métrica norte del experimento de siembra: el primer win real del usuario.
 *
 * Se mide acá y no en los slices porque `first_action` necesita cruzar el bus
 * de dominio con el flag de siembra, y los slices no conocen i18n ni
 * telemetría (regla que `goalSlice` documenta). Emite una sola vez por app:
 * después del primer Completo, `fromSeed` deja de informar.
 */
const useFirstActionTelemetry = (): void => {
  useEffect(() => {
    let emitted = false;
    const intro = useIntroStore.getState();

    const elapsedSeconds = () => {
      if (!intro.starterSeededAt) return 0;
      const seededAt = Date.parse(intro.starterSeededAt);
      if (Number.isNaN(seededAt)) return 0;
      return Math.max(0, Math.round((Date.now() - seededAt) / 1000));
    };

    const report = (kind: string, entityId: string) => {
      if (emitted) return;
      emitted = true;
      recordTelemetry('onboarding.first_action', {
        kind,
        fromSeed: useProductivityStore.getState().isSeeded(entityId),
        secondsSinceSeed: elapsedSeconds(),
      });
    };

    const offGoal = appEventBus.on('productivity.goalCompleted', ({ goalId }) => {
      report('goal', goalId);
    });
    const offHabit = appEventBus.on('productivity.habitCompleted', ({ habitId }) => {
      report('habit', habitId);
    });
    return () => {
      offGoal();
      offHabit();
    };
  }, []);
};

export const useProductivityTelemetry = (): void => {
  useProductivityEventEffects();
  useFirstActionTelemetry();
};
