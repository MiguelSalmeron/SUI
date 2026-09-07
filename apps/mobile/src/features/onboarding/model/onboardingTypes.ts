import type { UserIntention } from '@/shared/account/introTypes';

export type OnboardingStep =
  | 'welcome'
  | 'value_goals'
  | 'value_habits'
  | 'intention'
  | 'account';

export interface IntentionOption {
  id: UserIntention;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  badgeKey?: string;
}
