import { renderHook, act } from '@testing-library/react-native';
import { useOnboardingFlow, TOTAL_ONBOARDING_STEPS } from '../useOnboardingFlow';

describe('useOnboardingFlow', () => {
  it('inicializa en el paso 0 con 2 pasos totales y selectedIntention por defecto', async () => {
    const { result } = await renderHook(() => useOnboardingFlow());

    expect(result.current.currentStep).toBe(0);
    expect(result.current.totalSteps).toBe(2);
    expect(result.current.selectedIntention).toBe('explore');
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
    const { result } = await renderHook(() => useOnboardingFlow(1));

    await act(async () => {
      result.current.prevStep();
    });
    expect(result.current.currentStep).toBe(0);

    await act(async () => {
      result.current.prevStep();
      result.current.prevStep();
    });
    expect(result.current.currentStep).toBe(0);
  });

  it('ignora pasos fuera de rango y conserva la intención al volver', async () => {
    const { result } = await renderHook(() => useOnboardingFlow());
    await act(async () => {
      result.current.setSelectedIntention('agenda');
      result.current.goToStep(1);
    });
    await act(async () => {
      result.current.goToStep(2);
      result.current.goToStep(-1);
    });
    expect(result.current.currentStep).toBe(1);
    await act(async () => {
      result.current.prevStep();
    });
    expect(result.current.selectedIntention).toBe('agenda');
  });

  it('permite cambiar la intención seleccionada', async () => {
    const { result } = await renderHook(() => useOnboardingFlow());

    await act(async () => {
      result.current.setSelectedIntention('goal');
    });
    expect(result.current.selectedIntention).toBe('goal');
  });
});
