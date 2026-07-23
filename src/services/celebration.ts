import * as Haptics from 'expo-haptics';
import { XP_GOAL, XP_HABIT, XP_POMODORO } from './gamification';

export type CelebrationKind = 'goal' | 'habit' | 'pomodoro' | 'perfect_day';

const XP_BY_KIND: Record<CelebrationKind, number> = {
  goal: XP_GOAL,
  habit: XP_HABIT,
  pomodoro: XP_POMODORO,
  perfect_day: 0,
};

const TITLE_BY_KIND: Record<CelebrationKind, string> = {
  goal: '¡Meta cumplida!',
  habit: '¡Hábito hecho!',
  pomodoro: '¡Pomodoro listo!',
  perfect_day: '¡Día perfecto!',
};

export const getCelebrationXp = (kind: CelebrationKind): number => XP_BY_KIND[kind];

export const getCelebrationTitle = (kind: CelebrationKind): string => TITLE_BY_KIND[kind];

export const playCelebrationHaptic = async (kind: CelebrationKind): Promise<void> => {
  try {
    if (kind === 'perfect_day' || kind === 'pomodoro') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Simulador o dispositivo sin haptics — ignorar.
  }
};
