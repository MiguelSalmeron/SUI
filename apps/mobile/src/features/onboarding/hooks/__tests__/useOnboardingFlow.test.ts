import { renderHook, act } from '@testing-library/react-native';
import { useOnboardingFlow, TOTAL_ONBOARDING_STEPS } from '../useOnboardingFlow';

describe('useOnboardingFlow', () => {
  it('inicializa en el paso 0 con 4 pasos totales y selectedIntention por defecto', async () => {
    const { result } = await renderHook(() => useOnboardingFlow());

    expect(result.current.currentStep).toBe(0);
    expect(result.current.totalSteps).toBe(4);
    expect(result.current.selectedIntention).toBe('habit');
  });

  it('avanza los pasos correctamente sin sobrepasar el total', async () => {
    const { result } = await renderHook(() => useOnboardingFlow());

    await act(async () => {
      result.current.nextStep();
    });
    expect(result.current.currentStep).toBe(1);

    await act(async () => {
      result.current.nextStep();
      result.current.nextStep();
      result.current.nextStep();
      result.current.nextStep();
    });
    expect(result.current.currentStep).toBe(TOTAL_ONBOARDING_STEPS - 1);
  });

  it('retrocede los pasos sin bajar de 0', async () => {
    const { result } = await renderHook(() => useOnboardingFlow(2));

    await act(async () => {
      result.current.prevStep();
    });
    expect(result.current.currentStep).toBe(1);

    await act(async () => {
      result.current.prevStep();
      result.current.prevStep();
    });
    expect(result.current.currentStep).toBe(0);
  });

  it('permite cambiar la intención seleccionada', async () => {
    const { result } = await renderHook(() => useOnboardingFlow());

    await act(async () => {
      result.current.setSelectedIntention('goal');
    });
    expect(result.current.selectedIntention).toBe('goal');
  });
});
