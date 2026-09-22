import { act, renderHook } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { FONTS_TIMEOUT_MS, useFontsReady } from '../useFontsReady';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));

const mockUseFonts = useFonts as jest.Mock;

describe('useFontsReady', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseFonts.mockReturnValue([true, null]);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('listo cuando las fuentes cargan', async () => {
    const { result } = await renderHook(() => useFontsReady());

    expect(result.current).toEqual({ ready: true, status: 'loaded' });
  });

  it('degrada a sistema cuando las fuentes fallan (no splash eterno)', async () => {
    mockUseFonts.mockReturnValue([false, new Error('OTS fail')]);

    const { result } = await renderHook(() => useFontsReady());

    expect(result.current).toEqual({ ready: true, status: 'error' });
  });

  it('degrada por timeout cuando las fuentes se cuelgan', async () => {
    mockUseFonts.mockReturnValue([false, null]);

    const { result } = await renderHook(() => useFontsReady());
    expect(result.current).toEqual({ ready: false, status: 'loading' });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(FONTS_TIMEOUT_MS);
    });
    expect(result.current).toEqual({ ready: true, status: 'timeout' });
  });
});
