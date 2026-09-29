import { act } from 'react';
import { create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Animated } from 'react-native';

jest.mock('@/shared/theme/theme', () => ({
  MD3_RADIUS: { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 28, full: 9999 },
  useAppTheme: () => ({
    colors: {
      surfaceContainerHigh: '#E6F0F4',
      surfaceContainerHighest: '#DCE9EF',
    },
    motion: { indeterminate: { rotate: 1100, shimmer: 800 } },
  }),
}));
jest.mock('react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo', () => ({
  __esModule: true,
  default: { isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)) },
}));

import { Skeleton } from '../Skeleton';

const accessibilityMock = jest.requireMock(
  'react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo',
) as { default: { isReduceMotionEnabled: jest.Mock } };

describe('Skeleton (§12, §15)', () => {
  let renderer: ReactTestRenderer | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    accessibilityMock.default.isReduceMotionEnabled.mockResolvedValue(false);
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = undefined;
    jest.restoreAllMocks();
  });

  const renderSkeleton = async (): Promise<ReactTestInstance> => {
    await act(async () => {
      renderer = create(<Skeleton />);
    });
    return renderer?.root as ReactTestInstance;
  };

  it('es decorativo: queda fuera del árbol accesible', async () => {
    const root = await renderSkeleton();
    const box = root.findAllByType('View')[0];

    expect(box?.props.importantForAccessibility).toBe('no');
    expect(box?.props.accessibilityElementsHidden).toBe(true);
  });

  it('brilla con el token de movimiento indeterminado', async () => {
    const timing = jest.spyOn(Animated, 'timing');

    await renderSkeleton();
    await act(async () => undefined);

    expect(timing).toHaveBeenCalled();
    const config = timing.mock.calls[timing.mock.calls.length - 1]?.[1] as { duration: number };
    expect(config.duration).toBe(800);
  });

  it('con reducción de movimiento no arranca el brillo', async () => {
    accessibilityMock.default.isReduceMotionEnabled.mockResolvedValue(true);
    const loop = jest.spyOn(Animated, 'loop');

    await renderSkeleton();
    await act(async () => undefined);

    expect(loop).not.toHaveBeenCalled();
  });
});
