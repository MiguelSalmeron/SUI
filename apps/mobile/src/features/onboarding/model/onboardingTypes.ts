import type { UserIntention } from '@/shared/account/introTypes';

export type OnboardingStep = 'welcome' | 'account';

export interface IntentionOption {
  id: UserIntention;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  badgeKey?: string;
}
