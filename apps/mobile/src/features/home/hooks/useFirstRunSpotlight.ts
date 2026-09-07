import { useState } from 'react';
import { useIntroStore } from '@/shared/account/useIntroStore';

export type SpotlightStep = 'agenda' | 'chat' | 'action';

export const useFirstRunSpotlight = () => {
  const firstRunGuideDismissed = useIntroStore((state) => state.firstRunGuideDismissed);
  const dismissFirstRunGuide = useIntroStore((state) => state.dismissFirstRunGuide);
  const userIntention = useIntroStore((state) => state.userIntention);

  const [currentSpotlightIndex, setCurrentSpotlightIndex] = useState(0);

  const steps: SpotlightStep[] = ['agenda', 'chat', 'action'];

  const nextSpotlight = () => {
    if (currentSpotlightIndex < steps.length - 1) {
      setCurrentSpotlightIndex((prev) => prev + 1);
    } else {
      dismissFirstRunGuide();
    }
  };

  const skipSpotlight = () => {
    dismissFirstRunGuide();
  };

  return {
    visible: !firstRunGuideDismissed,
    step: steps[currentSpotlightIndex],
    stepIndex: currentSpotlightIndex,
    totalSteps: steps.length,
    userIntention,
    nextSpotlight,
    skipSpotlight,
  };
};
