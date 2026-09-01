import { useEffect } from 'react';
import { useI18n } from '@/shared/i18n/i18n';
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
