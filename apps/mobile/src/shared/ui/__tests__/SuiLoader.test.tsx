import { act } from 'react';
import { create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

jest.mock('@/shared/theme/theme', () => ({
  useAppTheme: () => ({
    colors: { primary: '#62C4F2' },
    motion: { indeterminate: { rotate: 1100, shimmer: 800 } },
  }),
}));
jest.mock('react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo', () => ({
  __esModule: true,
  default: { isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)) },
}));

import { SUI_LOADER_SIZE, SuiLoader } from '../SuiLoader';

const accessibilityMock = jest.requireMock(
  'react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo',
) as { default: { isReduceMotionEnabled: jest.Mock } };

describe('SuiLoader (§12, §13)', () => {
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

  const renderLoader = async (): Promise<ReactTestInstance> => {
    await act(async () => {
      renderer = create(<SuiLoader />);
    });
    return renderer?.root as ReactTestInstance;
  };

  it('dibuja el anillo como geometría y con el color del tema', async () => {
    const root = await renderLoader();
    const ring = root.findAllByType(Circle)[0];

    expect(ring.props.fill).toBe('none');
    expect(ring.props.strokeLinecap).toBe('round');
    expect(typeof ring.props.strokeDasharray).toBe('string');
    // Default = colors.primary, que se resuelve por esquema.
    expect(ring.props.stroke).toBe('#62C4F2');
  });

  it('usa la caja de la familia acción en curso', async () => {
    expect(SUI_LOADER_SIZE).toBe(20);

    const root = await renderLoader();
    expect(root.findAllByType(Svg)[0]?.props.width).toBe(20);
  });

  it('es decorativo: queda fuera del árbol accesible', async () => {
    const root = await renderLoader();
    const box = root.findAllByType('View')[0];

    expect(box?.props.importantForAccessibility).toBe('no');
    expect(box?.props.accessibilityElementsHidden).toBe(true);
  });

  it('gira con el token de movimiento indeterminado', async () => {
    const timing = jest.spyOn(Animated, 'timing');

    await renderLoader();
    await act(async () => undefined);

    expect(timing).toHaveBeenCalled();
    const config = timing.mock.calls[timing.mock.calls.length - 1]?.[1] as { duration: number };
    expect(config.duration).toBe(1100);
  });

  it('con reducción de movimiento no arranca el giro', async () => {
    accessibilityMock.default.isReduceMotionEnabled.mockResolvedValue(true);
    const loop = jest.spyOn(Animated, 'loop');

    await renderLoader();
    await act(async () => undefined);

    expect(loop).not.toHaveBeenCalled();
  });

  it('anima cuando la plataforma no expone la preferencia', async () => {
    const target = accessibilityMock.default as { isReduceMotionEnabled?: jest.Mock };
    const original = target.isReduceMotionEnabled;
    target.isReduceMotionEnabled = undefined;
    const loop = jest.spyOn(Animated, 'loop');

    try {
      await renderLoader();
      await act(async () => undefined);

      expect(loop).toHaveBeenCalled();
    } finally {
      target.isReduceMotionEnabled = original;
    }
  });
});
