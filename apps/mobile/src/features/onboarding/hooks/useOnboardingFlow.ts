import { useState } from 'react';
import type { UserIntention } from '@/shared/account/introTypes';
import type { OnboardingStep } from '../model/onboardingTypes';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'welcome',
  'value_goals',
  'value_habits',
  'account',
];

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length;

export const useOnboardingFlow = (initialStep = 0) => {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedIntention, setSelectedIntention] = useState<UserIntention>('habit');

  const nextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_ONBOARDING_STEPS - 1));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const goToStep = (step: number) => {
    if (step >= 0 && step < TOTAL_ONBOARDING_STEPS) {
      setCurrentStep(step);
    }
  };

  return {
    currentStep,
    totalSteps: TOTAL_ONBOARDING_STEPS,
    selectedIntention,
    setSelectedIntention,
    nextStep,
    prevStep,
    goToStep,
  };
};
