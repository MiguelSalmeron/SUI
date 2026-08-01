import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EMPTY_PROFILE,
  GOALS_REQUIRED,
  OnboardingProfile,
  OnboardingStep,
  STEP_ORDER,
  BotPersonality,
  Chronotype,
} from '../types/onboarding';

export const ONBOARDING_STORAGE_KEY = 'sui-onboarding-v3';

interface OnboardingState {
  /** true una vez que el estado fue rehidratado desde AsyncStorage. */
  hydrated: boolean;
  /** Paso actual de la máquina de estados (Tunneling). */
  step: OnboardingStep;
  profile: OnboardingProfile;
  selectedGoals: string[];
  /** Bandera para reintentar el alta anónima cuando no hubo red. */
  syncPending: boolean;
  anonUid: string | null;
  /** Gate principal de navegación. */
  onboardingComplete: boolean;

  // Acciones de captura
  setName: (name: string) => void;
  setHasRoute: (hasRoute: 'yes' | 'no') => void;
  setCareer: (career: string) => void;
  setBotPersonality: (personality: BotPersonality) => void;
  setChronotype: (chronotype: Chronotype) => void;
  setBirthYear: (year: number) => void;
  toggleGoal: (id: string) => void;

  // Acciones de flujo
  goToStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  markComplete: (payload: { uid: string | null; syncPending: boolean }) => void;
  setSyncPending: (pending: boolean) => void;
  reset: () => void;

  // Interno (rehidratación)
  setHydrated: (value: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      step: 'welcome',
      profile: { ...EMPTY_PROFILE },
      selectedGoals: [],
      syncPending: false,
      anonUid: null,
      onboardingComplete: false,

      setName: (name) =>
        set((state) => ({ profile: { ...state.profile, name: name.trim() } })),

      setHasRoute: (hasRoute) =>
        set((state) => ({ profile: { ...state.profile, hasRoute } })),

      setCareer: (career) =>
        set((state) => ({ profile: { ...state.profile, career: career.trim() } })),

      setBotPersonality: (botPersonality) =>
        set((state) => ({ profile: { ...state.profile, botPersonality } })),

      setChronotype: (chronotype) =>
        set((state) => ({ profile: { ...state.profile, chronotype } })),

      setBirthYear: (year) =>
        set((state) => ({ profile: { ...state.profile, birthYear: year } })),

      toggleGoal: (id) =>
        set((state) => {
          if (state.selectedGoals.includes(id)) {
            return { selectedGoals: state.selectedGoals.filter((g) => g !== id) };
          }
          if (state.selectedGoals.length >= GOALS_REQUIRED) {
            return {};
          }
          return { selectedGoals: [...state.selectedGoals, id] };
        }),

      goToStep: (step) => set({ step }),

      nextStep: () => {
        const { step, profile } = get();
        // Si estamos en 'hasRoute' y la respuesta es 'no', saltamos 'career' directo a 'botPersonality'
        if (step === 'hasRoute' && profile.hasRoute === 'no') {
          set({ step: 'botPersonality' });
          return;
        }

        const currentIndex = STEP_ORDER.indexOf(step);
        const next = STEP_ORDER[currentIndex + 1];
        if (next) {
          set({ step: next });
        }
      },

      markComplete: ({ uid, syncPending }) =>
        set({
          step: 'done',
          onboardingComplete: true,
          anonUid: uid,
          syncPending,
        }),

      setSyncPending: (pending) => set({ syncPending: pending }),

      reset: () =>
        set({
          step: 'welcome',
          profile: { ...EMPTY_PROFILE },
          selectedGoals: [],
          syncPending: false,
          anonUid: null,
          onboardingComplete: false,
        }),

      setHydrated: (value) => set({ hydrated: value }),
    }),
    {
      name: ONBOARDING_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        step: state.step,
        profile: state.profile,
        selectedGoals: state.selectedGoals,
        syncPending: state.syncPending,
        anonUid: state.anonUid,
        onboardingComplete: state.onboardingComplete,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
