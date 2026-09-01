import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccountMode, ConsentRecord, IntroStep } from './introTypes';

export const INTRO_STORAGE_KEY = 'sui-onboarding-v3';
const INTRO_STORAGE_VERSION = 4;

export interface IntroState {
  hydrated: boolean;
  step: IntroStep;
  introComplete: boolean;
  accountMode: AccountMode;
  syncEnabled: boolean;
  consent: ConsentRecord | null;
  firstRunGuideDismissed: boolean;
  technicalAuthPending: boolean;
  pendingCloudMerge: boolean;
  setHydrated: (value: boolean) => void;
  acceptPolicy: (consent: ConsentRecord) => void;
  completeIntro: (mode: AccountMode, syncEnabled?: boolean) => void;
  registerAccount: (syncEnabled: boolean) => void;
  setSyncEnabled: (enabled: boolean) => void;
  setTechnicalAuthPending: (pending: boolean) => void;
  setPendingCloudMerge: (pending: boolean) => void;
  dismissFirstRunGuide: () => void;
  resetIntro: () => void;
}

type LegacyIntroState = {
  onboardingComplete?: boolean;
  syncPending?: boolean;
  profile?: { name?: string };
};

export const migrateIntroState = (
  persisted: unknown,
): Pick<
  IntroState,
  | 'step'
  | 'introComplete'
  | 'accountMode'
  | 'syncEnabled'
  | 'consent'
  | 'firstRunGuideDismissed'
  | 'technicalAuthPending'
  | 'pendingCloudMerge'
> => {
  const legacy = (persisted ?? {}) as Partial<IntroState> & LegacyIntroState;
  const wasComplete = legacy.introComplete ?? legacy.onboardingComplete ?? false;
  return {
    step: wasComplete ? 'complete' : 'welcome',
    introComplete: wasComplete,
    accountMode: legacy.accountMode ?? 'local',
    syncEnabled: legacy.syncEnabled ?? false,
    consent: legacy.consent ?? null,
    firstRunGuideDismissed: legacy.firstRunGuideDismissed ?? wasComplete,
    technicalAuthPending: legacy.technicalAuthPending ?? legacy.syncPending ?? false,
    pendingCloudMerge: legacy.pendingCloudMerge ?? false,
  };
};

export const useIntroStore = create<IntroState>()(
  persist(
    (set) => ({
      hydrated: false,
      step: 'welcome',
      introComplete: false,
      accountMode: 'local',
      syncEnabled: false,
      consent: null,
      firstRunGuideDismissed: false,
      technicalAuthPending: false,
      pendingCloudMerge: false,
      setHydrated: (hydrated) => set({ hydrated }),
      acceptPolicy: (consent) => set({ consent }),
      completeIntro: (accountMode, syncEnabled = false) =>
        set({ step: 'complete', introComplete: true, accountMode, syncEnabled }),
      registerAccount: (syncEnabled) =>
        set({ step: 'complete', introComplete: true, accountMode: 'registered', syncEnabled }),
      setSyncEnabled: (syncEnabled) => set({ syncEnabled }),
      setTechnicalAuthPending: (technicalAuthPending) => set({ technicalAuthPending }),
      setPendingCloudMerge: (pendingCloudMerge) => set({ pendingCloudMerge }),
      dismissFirstRunGuide: () => set({ firstRunGuideDismissed: true }),
      resetIntro: () =>
        set({
          step: 'welcome',
          introComplete: false,
          accountMode: 'local',
          syncEnabled: false,
          consent: null,
          firstRunGuideDismissed: false,
          technicalAuthPending: false,
          pendingCloudMerge: false,
        }),
    }),
    {
      name: INTRO_STORAGE_KEY,
      version: INTRO_STORAGE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted) => migrateIntroState(persisted) as IntroState,
      partialize: (state) => ({
        step: state.step,
        introComplete: state.introComplete,
        accountMode: state.accountMode,
        syncEnabled: state.syncEnabled,
        consent: state.consent,
        firstRunGuideDismissed: state.firstRunGuideDismissed,
        technicalAuthPending: state.technicalAuthPending,
        pendingCloudMerge: state.pendingCloudMerge,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
