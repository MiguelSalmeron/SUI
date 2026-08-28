import type { Locale } from '@/shared/i18n/translations';

export type AccountMode = 'local' | 'registered';
export type AuthProvider = 'password' | 'google' | 'apple';
export type IntroStep = 'welcome' | 'account' | 'complete';

export type ConsentRecord = {
  minimumAgeConfirmed: boolean;
  policyVersion: string;
  acceptedAt: string;
  locale: Locale;
};
