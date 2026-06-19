import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EMPTY_PROFILE,
  GOALS_REQUIRED,
  OnboardingProfile,
  OnboardingStep,
  STEP_ORDER,
} from '../types/onboarding';

export const ONBOARDING_STORAGE_KEY = 'sui-onboarding-v1';

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
  setCareer: (career: string) => void;
  setStudyYear: (year: number) => void;
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

      setCareer: (career) =>
        set((state) => ({ profile: { ...state.profile, career: career.trim() } })),

      setStudyYear: (year) =>
        set((state) => ({ profile: { ...state.profile, studyYear: year } })),

      setBirthYear: (year) =>
        set((state) => ({ profile: { ...state.profile, birthYear: year } })),

      toggleGoal: (id) =>
        set((state) => {
          if (state.selectedGoals.includes(id)) {
            return { selectedGoals: state.selectedGoals.filter((g) => g !== id) };
          }
          // No permitir más de GOALS_REQUIRED selecciones.
          if (state.selectedGoals.length >= GOALS_REQUIRED) {
            return {};
          }
          return { selectedGoals: [...state.selectedGoals, id] };
        }),

      goToStep: (step) => set({ step }),

      nextStep: () => {
        const { step } = get();
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
      // No persistimos `hydrated`: es un flag de ciclo de vida en memoria.
      partialize: (state) => ({
        step: state.step,
        profile: state.profile,
        selectedGoals: state.selectedGoals,
        syncPending: state.syncPending,
        anonUid: state.anonUid,
        onboardingComplete: state.onboardingComplete,
      }),
      onRehydrateStorage: () => (state) => {
        // Se ejecuta cuando termina la rehidratación (Guardián de Estado).
        state?.setHydrated(true);
      },
    }
  )
);
