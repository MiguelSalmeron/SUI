import { act } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { Animated } from 'react-native';

// Regresión pantalla gris (APK release, Fabric): ningún componente host
// común (View/Text/...) puede recibir Animated.Value en el style. Solo
// Animated.* sabe resolverlos en nativo; en un View común Fabric lanza
// "opacity: Value is an object" y el frame muere -> gris.
jest.mock('@/shared/theme/theme', () => {
  const leaf = new Proxy({}, { get: () => '#000' });
  const textStyle = new Proxy({}, { get: () => ({}) });
  return {
    SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    useAppTheme: () => ({
      scheme: 'dark',
      colors: leaf,
      radius: { full: 999, xl: 16 },
      type: textStyle,
    }),
  };
});
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ locale: 'es', t: (key: string) => key }),
}));
jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/ui/SuiDoodle', () => ({ SuiDoodle: () => null }));
jest.mock('@/shared/ui/SuiMark', () => ({ SuiMark: () => null }));
jest.mock(
  'react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo',
  () => ({
    __esModule: true,
    default: { isReduceMotionEnabled: () => Promise.resolve(false) },
  }),
);

import { WelcomeScreen } from '../WelcomeScreen';
import { AccountDecisionView } from '../../components/AccountDecisionView';

const navigation = { navigate: jest.fn(), replace: jest.fn() } as never;
const route = { key: 'welcome', name: 'Welcome' } as never;

const isAnimatedLeaf = (value: unknown): boolean =>
  value instanceof Animated.Value ||
  (typeof value === 'object' &&
    value !== null &&
    typeof (value as { __getValue?: unknown }).__getValue === 'function');

const styleHasAnimated = (style: unknown, seen: Set<unknown> = new Set()): boolean => {
  if (style == null || typeof style === 'boolean') return false;
  if (isAnimatedLeaf(style)) return true;
  if (typeof style !== 'object') return false;
  if (seen.has(style)) return false;
  seen.add(style);
  const values = Array.isArray(style)
    ? style
    : Object.values(style as Record<string, unknown>);
  return values.some((value) => styleHasAnimated(value, seen));
};

const animatedExports = new Set<unknown>(Object.values(Animated));

/** Resumen mínimo: serializar nodos con Animated.Value revienta el heap de jest. */
const describeOffenders = (root: ReactTestInstance): string[] =>
  root
    .findAll(
      (node) =>
        typeof node.type === 'string' &&
        styleHasAnimated(node.props.style) &&
        !animatedExports.has(node.parent?.type),
    )
    .map((node) => `${String(node.type)}<${String(node.parent?.type)}>`);

const stringsOf = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => stringsOf(item, out));
  return out;
};

const textsOf = (node: ReactTestInstance): string =>
  node
    .findAllByType('Text')
    .flatMap((t) => stringsOf(t.props.children))
    .join(' ');

const pressButtonWithText = (root: ReactTestInstance, text: string) => {
  const button = root
    .findAll(
      (node) =>
        node.props.accessibilityRole === 'button' &&
        typeof node.props.onPress === 'function',
    )
    .find((node) => textsOf(node).includes(text));
  if (!button) throw new Error(`Botón con texto ${text} no encontrado`);
  const onPress = button.props.onPress;
  if (typeof onPress !== 'function') throw new Error(`Botón ${text} sin onPress`);
  act(() => {
    onPress();
  });
};

describe('Onboarding sin valores animados en hosts comunes', () => {
  let renderer: ReactTestRenderer | undefined;

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = undefined;
    jest.clearAllMocks();
  });

  it('Welcome step 0 monta el CTA sin offenders', async () => {
    await act(async () => {
      renderer = create(<WelcomeScreen navigation={navigation} route={route} />);
    });

    expect(textsOf(renderer?.root as ReactTestInstance)).toContain('welcome.start');
    expect(describeOffenders(renderer?.root as ReactTestInstance)).toEqual([]);
  });

  it('Welcome step 3 (AccountDecision) monta sin offenders', async () => {
    await act(async () => {
      renderer = create(<WelcomeScreen navigation={navigation} route={route} />);
    });
    const root = renderer?.root as ReactTestInstance;

    pressButtonWithText(root, 'welcome.start');
    pressButtonWithText(root, 'welcome.next');
    pressButtonWithText(root, 'welcome.next');

    expect(textsOf(root)).toContain('onboarding.privacyTitle');
    expect(describeOffenders(root)).toEqual([]);
  });

  it('AccountDecisionView aislado monta sin offenders', async () => {
    await act(async () => {
      renderer = create(
        <AccountDecisionView
          onContinueLocal={() => undefined}
          onOpenRegister={() => undefined}
          onOpenLogin={() => undefined}
        />,
      );
    });
    const root = renderer?.root as ReactTestInstance;

    expect(textsOf(root)).toContain('onboarding.privacyTitle');
    expect(describeOffenders(root)).toEqual([]);
  });
});
