import { act, renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { MOTION } from '@/shared/ui/motion/motionTokens';
import { useReduceMotion } from '@/shared/ui/motion/useReduceMotion';
import { useOrganicEntrance } from '../useOrganicEntrance';

jest.mock('@/shared/ui/motion/useReduceMotion', () => ({ useReduceMotion: jest.fn() }));
const motion = jest.mocked(useReduceMotion);

describe('entrada orgánica', () => {
  afterEach(() => jest.restoreAllMocks());

  it('entrada de 320ms escalonada usa driver nativo', async () => {
    motion.mockReturnValue(false);
    const timing = jest
      .spyOn(Animated, 'timing')
      .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
    await renderHook(() => useOrganicEntrance({ delay: 90 }));
    expect(timing).toHaveBeenCalledTimes(3);
    for (const [, config] of timing.mock.calls) {
      expect(config).toMatchObject({
        duration: MOTION.durations.smooth,
        delay: 90,
        useNativeDriver: true,
      });
    }
  });

  it('reduce-motion deja contenido visible y cancela entrada en curso', async () => {
    motion.mockReturnValue(false);
    const stop = jest.fn();
    jest.spyOn(Animated, 'parallel').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
    const { result, rerender } = await renderHook(() => useOrganicEntrance());
    motion.mockReturnValue(true);
    await act(async () => {
      await rerender(undefined);
    });
    expect(stop).toHaveBeenCalled();
    expect((result.current.opacity as unknown as { __getValue: () => number }).__getValue()).toBe(
      1,
    );
    expect(
      (result.current.translateY as unknown as { __getValue: () => number }).__getValue(),
    ).toBe(0);
    expect((result.current.scale as unknown as { __getValue: () => number }).__getValue()).toBe(1);
  });
});
