import { act } from 'react';
import { create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Circle, Rect } from 'react-native-svg';

// Paletas de referencia. `background` es un centinela: si algún tile lo vuelve
// a usar como superficie (el antiguo tile navy hardcodeado en dark), el tile
// desaparece contra el fondo y estos tests fallan.
jest.mock('@/shared/theme/theme', () => {
  const darkColors = {
    primary: '#62C4F2',
    primaryContainer: '#174D69',
    secondary: '#AACDC1',
    secondaryContainer: '#365A50',
    flame: '#FFB078',
    flameContainer: '#4A2D1A',
    surface: '#111C32',
    surfaceContainerHigh: '#1C2C49',
    surfaceContainerHighest: '#243654',
    inverseSurface: '#E3E3E9',
    inversePrimary: '#1677A6',
    outlineVariant: '#344861',
    background: '#0B132B',
  };
  const lightColors = {
    primary: '#1677A6',
    primaryContainer: '#D9EEF8',
    secondary: '#55796F',
    secondaryContainer: '#DCEBE5',
    flame: '#E87536',
    flameContainer: '#FCE9DC',
    surface: '#FFFFFF',
    surfaceContainerHigh: '#E6F0F4',
    surfaceContainerHighest: '#DCE9EF',
    inverseSurface: '#0B132B',
    inversePrimary: '#62C4F2',
    outlineVariant: '#CAD9E0',
    background: '#F6FAFC',
  };
  const state: { scheme: 'dark' | 'light' } = { scheme: 'dark' };
  return {
    __esModule: true,
    SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    __setScheme: (scheme: 'dark' | 'light') => {
      state.scheme = scheme;
    },
    __colors: { dark: darkColors, light: lightColors },
    useAppTheme: () => ({
      scheme: state.scheme,
      colors: state.scheme === 'dark' ? darkColors : lightColors,
      radius: { full: 9999, xl: 28 },
      type: {},
    }),
  };
});
jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/ui/SuiDoodle', () => ({ SuiDoodle: () => null }));
jest.mock('react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo', () => ({
  __esModule: true,
  default: { isReduceMotionEnabled: () => Promise.resolve(false) },
}));

import { AnimatedMosaic } from '../AnimatedMosaic';

const themeMock = jest.requireMock('@/shared/theme/theme') as {
  __setScheme: (scheme: 'dark' | 'light') => void;
  __colors: { dark: Record<string, string>; light: Record<string, string> };
};

const flattenStyle = (style: unknown): Record<string, unknown> => {
  if (!style) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map((entry) => flattenStyle(entry)));
  }
  return style as Record<string, unknown>;
};

const tilesOf = (root: ReactTestInstance): ReactTestInstance[] =>
  root
    .findAllByType('View')
    .filter((node) => flattenStyle(node.props.style).borderRadius === 28);

describe('AnimatedMosaic', () => {
  let renderer: ReactTestRenderer | undefined;

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = undefined;
    jest.clearAllMocks();
  });

  const render = async (scheme: 'dark' | 'light') => {
    themeMock.__setScheme(scheme);
    await act(async () => {
      renderer = create(<AnimatedMosaic />);
    });
    return renderer?.root as ReactTestInstance;
  };

  it('dark: ningún tile usa el color de fondo como superficie', async () => {
    const root = await render('dark');
    const backgrounds = tilesOf(root).map((node) => flattenStyle(node.props.style).backgroundColor);
    expect(backgrounds).not.toContain(themeMock.__colors.dark.background);
    expect(backgrounds).toContain(themeMock.__colors.dark.inverseSurface);
  });

  it('dark: el tile hero va sin borde (ya contrasta 17:1)', async () => {
    const root = await render('dark');
    const hero = tilesOf(root).find(
      (node) =>
        flattenStyle(node.props.style).backgroundColor === themeMock.__colors.dark.inverseSurface,
    );
    expect(flattenStyle(hero?.props.style).borderWidth).toBe(0);
  });

  it('light: los tiles pastel se definen con borde de 1px outlineVariant', async () => {
    const root = await render('light');
    const tiles = tilesOf(root);
    const bordered = tiles.filter((node) => {
      const style = flattenStyle(node.props.style);
      return (
        style.borderWidth === 1 &&
        style.borderColor === themeMock.__colors.light.outlineVariant
      );
    });
    // 6 tiles, solo el hero (inverseSurface) queda sin borde.
    expect(tiles).toHaveLength(6);
    expect(bordered).toHaveLength(5);
  });

  it('light: ningún tile usa el color de fondo como superficie', async () => {
    const root = await render('light');
    const backgrounds = tilesOf(root).map((node) => flattenStyle(node.props.style).backgroundColor);
    expect(backgrounds).not.toContain(themeMock.__colors.light.background);
    expect(backgrounds).toContain(themeMock.__colors.light.inverseSurface);
  });

  it('el anillo de progreso es determinista (strokeDasharray) y no un borde abierto', async () => {
    const root = await render('dark');
    const ring = root
      .findAllByType(Circle)
      .find((node) => typeof node.props.strokeDasharray === 'string');
    expect(ring).toBeDefined();
    expect(ring?.props.strokeDashoffset).toBeGreaterThan(0);
  });

  it('el fundido inferior es un gradiente, no una banda sólida', async () => {
    const root = await render('dark');
    const gradientRect = root
      .findAllByType(Rect)
      .find((node) => String(node.props.fill).startsWith('url(#'));
    expect(gradientRect).toBeDefined();
  });
});
