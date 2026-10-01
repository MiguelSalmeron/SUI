/**
 * Aviso de contenido de ejemplo en Inicio.
 *
 * Las dos salidas son distintas a propósito y eso es lo que se verifica:
 * *Personalizar* conserva el dato, *Descartar* lo borra.
 */

import { act } from 'react';
import { create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/shared/theme/theme', () => {
  const leaf = new Proxy({}, { get: () => '#000' });
  const textStyle = new Proxy({}, { get: () => ({}) });
  return {
    SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    useAppTheme: () => ({
      scheme: 'dark',
      colors: leaf,
      radius: { full: 999, lg: 12, xl: 16 },
      type: textStyle,
    }),
  };
});
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ locale: 'es', t: (key: string) => key }),
}));
jest.mock('@/shared/ui/Ionicons', () => ({
  Ionicons: Object.assign(() => null, { glyphMap: {} }),
}));

import { StarterSeedBanner } from '../StarterSeedBanner';

const stringsOf = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => stringsOf(item, out));
  return out;
};

const textsOf = (node: ReactTestInstance): string =>
  node
    .findAllByType('Text')
    .flatMap((text) => stringsOf(text.props.children))
    .join(' ');

const render = (
  props: {
    goalTitle?: string;
    habitTitle?: string;
    onPersonalize?: () => void;
    onDismiss?: () => void;
  } = {},
) => {
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(
      <StarterSeedBanner
        goalTitle={props.goalTitle}
        habitTitle={props.habitTitle}
        onPersonalize={props.onPersonalize ?? jest.fn()}
        onDismiss={props.onDismiss ?? jest.fn()}
      />,
    );
  });
  return renderer!.root as ReactTestInstance;
};

const pressAction = (root: ReactTestInstance, key: string) => {
  const node = root
    .findAll(
      (candidate) =>
        candidate.props.accessibilityRole === 'button' &&
        typeof candidate.props.onPress === 'function' &&
        textsOf(candidate).includes(key),
    )
    .at(-1);
  if (!node) throw new Error(`Acción ${key} no encontrada`);
  const onPress = node.props.onPress as () => void;
  act(() => {
    onPress();
  });
};

describe('StarterSeedBanner', () => {
  it('anuncia que es un ejemplo y muestra el título real', () => {
    const root = render({ goalTitle: 'Terminar mi proyecto personal' });
    const texts = textsOf(root);
    expect(texts).toContain('onboarding.seed.bannerLabel');
    expect(texts).toContain('Terminar mi proyecto personal');
  });

  it('ofrece las dos salidas', () => {
    const root = render({ goalTitle: 'Meta' });
    const texts = textsOf(root);
    expect(texts).toContain('onboarding.seed.personalize');
    expect(texts).toContain('onboarding.seed.dismiss');
  });

  it('cada acción tiene etiqueta de accesibilidad propia', () => {
    const root = render({ goalTitle: 'Terminar mi proyecto personal' });
    const actions = root
      .findAll(
        (node) =>
          node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
      )
      .map((node) => node.props.accessibilityLabel as string);
    expect(actions).toContain('onboarding.seed.personalizeA11y');
    expect(actions).toContain('onboarding.seed.dismissA11y');
  });

  it('describe el aviso completo para lectores de pantalla', () => {
    const root = render({ goalTitle: 'Terminar mi proyecto personal' });
    const banner = root.findAll((node) => node.props.accessible === true);
    expect(banner.length).toBeGreaterThan(0);
    expect(banner[0].props.accessibilityLabel).toBe('onboarding.seed.bannerA11y');
  });

  it('el CTA de personalizar llama su callback', () => {
    const onPersonalize = jest.fn();
    const root = render({ goalTitle: 'Meta', onPersonalize });

    pressAction(root, 'onboarding.seed.personalize');

    expect(onPersonalize).toHaveBeenCalledTimes(1);
  });

  it('el CTA de descartar llama su callback', () => {
    const onDismiss = jest.fn();
    const root = render({ goalTitle: 'Meta', onDismiss });

    pressAction(root, 'onboarding.seed.dismiss');

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('usa el plural cuando hay meta y hábito', () => {
    const root = render({ goalTitle: 'Meta', habitTitle: 'Hábito' });
    expect(textsOf(root)).toContain('onboarding.seed.bannerLabelPlural');
  });

  it('usa el singular cuando sólo hay un ejemplo', () => {
    const root = render({ habitTitle: 'Leer 10 minutos' });
    const texts = textsOf(root);
    expect(texts).toContain('onboarding.seed.bannerLabel');
    expect(texts).not.toContain('onboarding.seed.bannerLabelPlural');
  });
});
