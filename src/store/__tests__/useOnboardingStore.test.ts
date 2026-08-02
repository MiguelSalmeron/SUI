import 'jest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EMPTY_PROFILE,
  GOALS_REQUIRED,
  STEP_ORDER,
} from '../../types/onboarding';
import { useOnboardingStore } from '../useOnboardingStore';

const mockStorage = AsyncStorage as typeof AsyncStorage & {
  __reset: () => void;
};

describe('useOnboardingStore', () => {
  beforeEach(() => {
    mockStorage.__reset();
    // Limpiar estado persistido + rehidratación pendiente.
    useOnboardingStore.getState().reset();
  });

  afterEach(() => {
    mockStorage.__reset();
  });

  it('reset() restaura el estado inicial', () => {
    const s = useOnboardingStore.getState();
    expect(s.step).toBe('welcome');
    expect(s.onboardingComplete).toBe(false);
    expect(s.selectedGoals).toEqual([]);
    expect(s.anonUid).toBeNull();
    expect(s.syncPending).toBe(false);
    // Misma forma y defaults que EMPTY_PROFILE.
    expect(s.profile).toEqual(EMPTY_PROFILE);
  });

  it('toggleGoal agrega y elimina por debajo del límite', () => {
    const { toggleGoal } = useOnboardingStore.getState();
    toggleGoal('sleep');
    expect(useOnboardingStore.getState().selectedGoals).toEqual(['sleep']);
    toggleGoal('focus');
    expect(useOnboardingStore.getState().selectedGoals).toEqual(['sleep', 'focus']);
    toggleGoal('sleep');
    expect(useOnboardingStore.getState().selectedGoals).toEqual(['focus']);
  });

  it(`toggleGoal respeta el límite de GOALS_REQUIRED (${GOALS_REQUIRED})`, () => {
    const { toggleGoal } = useOnboardingStore.getState();
    // Llenar hasta el límite con ids distintos.
    for (let i = 0; i < GOALS_REQUIRED; i++) {
      toggleGoal(`goal-${i}`);
    }
    expect(useOnboardingStore.getState().selectedGoals).toHaveLength(GOALS_REQUIRED);
    // Un nuevo id no debe agregarse (cap alcanzado).
    toggleGoal('extra');
    expect(useOnboardingStore.getState().selectedGoals).toHaveLength(GOALS_REQUIRED);
    expect(useOnboardingStore.getState().selectedGoals).not.toContain('extra');
  });

  it('toggleGoal es idempotente al alternar el mismo id dos veces lo elimina', () => {
    const { toggleGoal } = useOnboardingStore.getState();
    toggleGoal('sleep');
    toggleGoal('sleep');
    expect(useOnboardingStore.getState().selectedGoals).toEqual([]);
  });

  it("nextStep desde hasRoute con hasRoute='no' salta a botPersonality", () => {
    useOnboardingStore.setState({ step: 'hasRoute', profile: { ...EMPTY_PROFILE, hasRoute: 'no' } });
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().step).toBe('botPersonality');
  });

  it("nextStep desde hasRoute con hasRoute='yes' sigue STEP_ORDER hacia career", () => {
    useOnboardingStore.setState({ step: 'hasRoute', profile: { ...EMPTY_PROFILE, hasRoute: 'yes' } });
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().step).toBe('career');
  });

  it('nextStep desde el último paso es no-op', () => {
    const last = STEP_ORDER[STEP_ORDER.length - 1];
    useOnboardingStore.setState({ step: last });
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().step).toBe(last);
  });

  it('markComplete establece done/onboardingComplete/anonUid/syncPending', () => {
    useOnboardingStore.getState().markComplete({ uid: 'uid-123', syncPending: true });
    const s = useOnboardingStore.getState();
    expect(s.step).toBe('done');
    expect(s.onboardingComplete).toBe(true);
    expect(s.anonUid).toBe('uid-123');
    expect(s.syncPending).toBe(true);
  });

  it('setName recorta espacios', () => {
    useOnboardingStore.getState().setName('  Ana Pérez  ');
    expect(useOnboardingStore.getState().profile.name).toBe('Ana Pérez');
  });

  it('setBirthYear almacena el año en el perfil', () => {
    useOnboardingStore.getState().setBirthYear(2004);
    expect(useOnboardingStore.getState().profile.birthYear).toBe(2004);
  });
});
