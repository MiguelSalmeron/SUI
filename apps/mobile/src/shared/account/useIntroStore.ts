import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccountMode, ConsentRecord, IntroStep, UserIntention } from './introTypes';

export const INTRO_STORAGE_KEY = 'sui-onboarding-v3';
const INTRO_STORAGE_VERSION = 6;

export interface IntroState {
  hydrated: boolean;
  step: IntroStep;
  introComplete: boolean;
  accountMode: AccountMode;
  syncEnabled: boolean;
  consent: ConsentRecord | null;
  userIntention: UserIntention | null;
  firstRunGuideDismissed: boolean;
  technicalAuthPending: boolean;
  pendingCloudMerge: boolean;
  previousAnonymousUid: string | null;
  /**
   * Instante ISO de la siembra de arranque, o `null` si nunca corrió.
   *
   * Es el candado de idempotencia del sembrado: junto con "no hay metas ni
   * hábitos" evita sembrar dos veces al volver atrás en el flujo o al repetir
   * el primer ingreso. Además marca que el usuario ya pasó por Home con ejemplo,
   * así que descartarlo no lo vuelve a traer.
   */
  starterSeededAt: string | null;
  seededIntention: UserIntention | null;
  setHydrated: (value: boolean) => void;
  markStarterSeeded: (intention: UserIntention) => void;
  acceptPolicy: (consent: ConsentRecord) => void;
  setUserIntention: (intention: UserIntention) => void;
  completeIntro: (mode: AccountMode, syncEnabled?: boolean) => void;
  registerAccount: (syncEnabled: boolean) => void;
  setSyncEnabled: (enabled: boolean) => void;
  setTechnicalAuthPending: (pending: boolean) => void;
  setPendingCloudMerge: (pending: boolean) => void;
  setPreviousAnonymousUid: (uid: string | null) => void;
  dismissFirstRunGuide: () => void;
  resetIntro: () => void;
  /**
   * Variante de `resetIntro` para el logout, que además limpia la siembra.
   *
   * Vive en el store y no en la pantalla porque `resetIntro` se llama desde dos
   * sitios (salir y borrar cuenta) y el forget de las marcas tiene que ocurrir
   * en los dos, siempre junto al resto del estado de intro.
   */
  resetIntroAndSeeds: () => void;
}

type LegacyIntroState = {
  onboardingComplete?: boolean;
  syncPending?: boolean;
  profile?: { name?: string };
  userIntention?: UserIntention | null;
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
  | 'userIntention'
  | 'firstRunGuideDismissed'
  | 'technicalAuthPending'
  | 'pendingCloudMerge'
  | 'starterSeededAt'
  | 'seededIntention'
> => {
  const legacy = (persisted ?? {}) as Partial<IntroState> & LegacyIntroState;
  const wasComplete = legacy.introComplete ?? legacy.onboardingComplete ?? false;
  return {
    step: wasComplete ? 'complete' : 'welcome',
    introComplete: wasComplete,
    accountMode: legacy.accountMode ?? 'local',
    syncEnabled: legacy.syncEnabled ?? false,
    consent: legacy.consent ?? null,
    userIntention: legacy.userIntention ?? null,
    firstRunGuideDismissed: legacy.firstRunGuideDismissed ?? wasComplete,
    technicalAuthPending: legacy.technicalAuthPending ?? legacy.syncPending ?? false,
    pendingCloudMerge: legacy.pendingCloudMerge ?? false,
    // Un usuario previo a la siembra nunca la corrió, así que `null` es lo
    // fiel. Los que ya tienen metas tampoco se siembran: el candado de arrays
    // vacíos en `seedStarterData` los cubre igual.
    starterSeededAt: legacy.starterSeededAt ?? null,
    seededIntention: legacy.seededIntention ?? null,
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
      userIntention: null,
      firstRunGuideDismissed: false,
      technicalAuthPending: false,
      pendingCloudMerge: false,
      previousAnonymousUid: null,
      starterSeededAt: null,
      seededIntention: null,
      setHydrated: (hydrated) => set({ hydrated }),
      acceptPolicy: (consent) => set({ consent }),
      setUserIntention: (userIntention) => set({ userIntention }),
      markStarterSeeded: (seededIntention) =>
        set({ starterSeededAt: new Date().toISOString(), seededIntention }),
      completeIntro: (accountMode, syncEnabled = false) =>
        set({ step: 'complete', introComplete: true, accountMode, syncEnabled }),
      registerAccount: (syncEnabled) =>
        set({ step: 'complete', introComplete: true, accountMode: 'registered', syncEnabled }),
      setSyncEnabled: (syncEnabled) => set({ syncEnabled }),
      setTechnicalAuthPending: (technicalAuthPending) => set({ technicalAuthPending }),
      setPendingCloudMerge: (pendingCloudMerge) => set({ pendingCloudMerge }),
      setPreviousAnonymousUid: (previousAnonymousUid) => set({ previousAnonymousUid }),
      dismissFirstRunGuide: () => set({ firstRunGuideDismissed: true }),
      resetIntro: () =>
        set({
          step: 'welcome',
          introComplete: false,
          accountMode: 'local',
          syncEnabled: false,
          consent: null,
          userIntention: null,
          firstRunGuideDismissed: false,
          technicalAuthPending: false,
          pendingCloudMerge: false,
          previousAnonymousUid: null,
          starterSeededAt: null,
          seededIntention: null,
        }),
      resetIntroAndSeeds: () =>
        set({
          step: 'welcome',
          introComplete: false,
          accountMode: 'local',
          syncEnabled: false,
          consent: null,
          userIntention: null,
          firstRunGuideDismissed: false,
          technicalAuthPending: false,
          pendingCloudMerge: false,
          previousAnonymousUid: null,
          starterSeededAt: null,
          seededIntention: null,
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
        userIntention: state.userIntention,
        firstRunGuideDismissed: state.firstRunGuideDismissed,
        technicalAuthPending: state.technicalAuthPending,
        pendingCloudMerge: state.pendingCloudMerge,
        previousAnonymousUid: state.previousAnonymousUid,
        starterSeededAt: state.starterSeededAt,
        seededIntention: state.seededIntention,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);

export type { UserIntention } from './introTypes';
