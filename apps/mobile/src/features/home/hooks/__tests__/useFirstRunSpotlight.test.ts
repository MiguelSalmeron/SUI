import { renderHook, act } from '@testing-library/react-native';
import { useFirstRunSpotlight } from '../useFirstRunSpotlight';
import { useIntroStore } from '@/shared/account/useIntroStore';

describe('useFirstRunSpotlight', () => {
  beforeEach(() => {
    useIntroStore.getState().resetIntro();
  });

  it('inicia visible cuando firstRunGuideDismissed es false', async () => {
    const { result } = await renderHook(() => useFirstRunSpotlight());

    expect(result.current.visible).toBe(true);
    expect(result.current.step).toBe('agenda');
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.totalSteps).toBe(3);
  });

  it('avanza por agenda -> chat -> action y luego se descarta', async () => {
    const { result } = await renderHook(() => useFirstRunSpotlight());

    await act(async () => {
      result.current.nextSpotlight();
    });
    expect(result.current.step).toBe('chat');
    expect(result.current.stepIndex).toBe(1);

    await act(async () => {
      result.current.nextSpotlight();
    });
    expect(result.current.step).toBe('action');
    expect(result.current.stepIndex).toBe(2);

    await act(async () => {
      result.current.nextSpotlight();
    });
    expect(useIntroStore.getState().firstRunGuideDismissed).toBe(true);
  });

  it('permite omitir directamente el spotlight', async () => {
    const { result } = await renderHook(() => useFirstRunSpotlight());

    await act(async () => {
      result.current.skipSpotlight();
    });
    expect(useIntroStore.getState().firstRunGuideDismissed).toBe(true);
  });
});
