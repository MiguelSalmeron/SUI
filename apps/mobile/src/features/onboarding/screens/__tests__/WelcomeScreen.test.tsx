import { act } from 'react';
import { create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, type AccessibilityState } from 'react-native';

// Regresión pantalla gris (APK release, Fabric): ningún componente host
// común (View/Text/...) puede recibir Animated.Value en el style. Solo
// Animated.* sabe resolverlos en nativo; en un View común Fabric lanza
// "opacity: Value is an object" y el frame muere -> gris.
jest.mock('@/shared/theme/theme', () => {
  const leaf = new Proxy({}, { get: () => '#000' });
  const textStyle = new Proxy({}, { get: () => ({}) });
  return {
    SCREEN_MAX_CONTENT_WIDTH: 560,
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
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo', () => ({
  __esModule: true,
  default: { isReduceMotionEnabled: () => Promise.resolve(true) },
}));

jest.mock('@/shared/ui/motion/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('@/shared/observability/telemetry', () => ({ recordTelemetry: jest.fn() }));
// El store de productividad arrastra Firebase y persistencia; la pantalla sólo
// necesita la siembra y el catálogo de kits, que sí es puro.
jest.mock('@/shared/domain/productivity/public', () => ({
  useProductivityStore: (selector: (state: { seedStarterData: unknown }) => unknown) =>
    selector({ seedStarterData: jest.fn() }),
  STARTER_KITS: jest.requireActual('@/shared/domain/productivity/model/starterKits').STARTER_KITS,
}));

import { useIntroStore } from '../../store/useIntroStore';
import { PRODUCT_CONFIG } from '@/shared/config/product';
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
  const values = Array.isArray(style) ? style : Object.values(style as Record<string, unknown>);
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

const pressNode = (node: ReactTestInstance) => {
  const onPress = node.props.onPress;
  if (typeof onPress !== 'function') throw new Error('Control sin onPress');
  act(() => {
    onPress();
  });
};

const pressButtonWithText = (root: ReactTestInstance, text: string) => {
  const button = root
    .findAll(
      (node) =>
        node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
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

  beforeEach(() => {
    useIntroStore.getState().resetIntro();
  });

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

    expect(textsOf(renderer?.root as ReactTestInstance)).toContain('onboarding.seed.confirm');
    expect(describeOffenders(renderer?.root as ReactTestInstance)).toEqual([]);
  });

  it('Welcome paso 2 (AccountDecision) monta sin offenders', async () => {
    await act(async () => {
      renderer = create(<WelcomeScreen navigation={navigation} route={route} />);
    });
    const root = renderer?.root as ReactTestInstance;

    pressButtonWithText(root, 'onboarding.seed.confirm');

    expect(textsOf(root)).toContain('welcome.accountValueTitle');
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

    expect(textsOf(root)).toContain('welcome.accountValueTitle');
    expect(describeOffenders(root)).toEqual([]);
  });
  it('selecciona intención sin persistir hasta avanzar y conserva al volver', async () => {
    await act(async () => {
      renderer = create(<WelcomeScreen navigation={navigation} route={route} />);
    });
    const root = renderer!.root;
    expect(
      root.findAll((node) => node.type === 'View' && node.props.accessibilityRole === 'radiogroup'),
    ).toHaveLength(1);
    for (const id of ['goal', 'habit', 'agenda', 'explore']) {
      expect(textsOf(root)).toContain(`onboarding.intentions.${id}`);
    }
    pressButtonWithText(root, 'onboarding.intentions.agenda');
    expect(useIntroStore.getState().userIntention).toBeNull();
    pressButtonWithText(root, 'onboarding.seed.confirm');
    expect(useIntroStore.getState().userIntention).toBe('agenda');
    const back = root.findAll(
      (node) =>
        node.props.accessibilityLabel === 'welcome.back' &&
        typeof node.props.onPress === 'function',
    )[0];
    pressNode(back);
    const selected = root.findAll(
      (node) =>
        node.props.accessibilityRole === 'button' &&
        (node.props.accessibilityState as AccessibilityState | undefined)?.selected === true,
    );
    expect(selected[0].props.accessibilityLabel).toContain('onboarding.intentions.agenda');
  });

  it('exige reconocimiento offline y completa consentimiento antes de Home', async () => {
    await act(async () => {
      renderer = create(<WelcomeScreen navigation={navigation} route={route} />);
    });
    const root = renderer!.root;
    pressButtonWithText(root, 'onboarding.seed.confirm');
    pressButtonWithText(root, 'welcome.tryLocalTitle');
    const local = () =>
      root
        .findAll(
          (node) =>
            node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
        )
        .find((node) => textsOf(node).includes('welcome.localStart'))!;
    expect(local().props.disabled).toBe(true);
    pressNode(local());
    expect(useIntroStore.getState().introComplete).toBe(false);
    const checkbox = root.findAll(
      (node) =>
        node.props.accessibilityRole === 'checkbox' && typeof node.props.onPress === 'function',
    )[0];
    expect((checkbox.props.accessibilityState as AccessibilityState).checked).toBe(false);
    pressNode(checkbox);
    expect(local().props.disabled).toBe(false);
    pressButtonWithText(root, 'welcome.localStart');
    expect(useIntroStore.getState()).toMatchObject({
      introComplete: true,
      accountMode: 'local',
      syncEnabled: false,
      userIntention: 'explore',
      consent: {
        minimumAgeConfirmed: true,
        policyVersion: PRODUCT_CONFIG.policyVersion,
        locale: 'es',
      },
    });
    expect(useIntroStore.getState().consent?.acceptedAt).toEqual(expect.any(String));
    expect((navigation as { replace: jest.Mock }).replace).toHaveBeenCalledWith('Home');
  });

  it.each([
    ['welcome.create', 'Register'],
    ['welcome.login', 'Login'],
  ])('abre auth desde %s con consentimiento', async (text, routeName) => {
    await act(async () => {
      renderer = create(<WelcomeScreen navigation={navigation} route={route} />);
    });
    // El CTA del paso 0 es el del picker de intención, que además siembra.
    pressButtonWithText(renderer!.root, 'onboarding.seed.confirm');
    pressButtonWithText(renderer!.root, text);
    expect((navigation as { navigate: jest.Mock }).navigate).toHaveBeenCalledWith(routeName);
    expect(useIntroStore.getState().consent?.minimumAgeConfirmed).toBe(true);
    expect(useIntroStore.getState().introComplete).toBe(false);
  });

  it('al colapsar offline reinicia reconocimiento', async () => {
    await act(async () => {
      renderer = create(
        <AccountDecisionView
          onContinueLocal={jest.fn()}
          onOpenRegister={jest.fn()}
          onOpenLogin={jest.fn()}
        />,
      );
    });
    const root = renderer!.root;
    pressButtonWithText(root, 'welcome.tryLocalTitle');
    pressNode(
      root.findAll(
        (node) =>
          node.props.accessibilityRole === 'checkbox' && typeof node.props.onPress === 'function',
      )[0],
    );
    pressButtonWithText(root, 'welcome.tryLocalTitle');
    pressButtonWithText(root, 'welcome.tryLocalTitle');
    expect(
      (
        root.findAll((node) => node.props.accessibilityRole === 'checkbox')[0].props
          .accessibilityState as AccessibilityState
      ).checked,
    ).toBe(false);
  });
});
