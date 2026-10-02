/**
 * Picker de intención con vista previa de la siembra.
 *
 * Se prueba con `t` devolviendo la clave, así que el texto que aparece es la
 * clave del kit: eso verifica que el preview muestre el contenido real de la
 * intención elegida y no un placeholder.
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
// `t` devuelve la clave para poder verificar que el preview muestra el
// contenido real del kit y no un placeholder.
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ locale: 'es', t: (key: string) => key }),
}));
jest.mock('@/shared/ui/Ionicons', () => ({
  Ionicons: Object.assign(() => null, { glyphMap: {} }),
}));
jest.mock('@/shared/ui/motion/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('@/shared/observability/telemetry', () => ({ recordTelemetry: jest.fn() }));

// El barrel de productividad arrastra Firebase y persistencia; al picker sólo
// le interesa el catálogo de kits, que es puro.
jest.mock('@/shared/domain/productivity/public', () => ({
  STARTER_KITS: jest.requireActual('@/shared/domain/productivity/model/starterKits').STARTER_KITS,
}));

import type { UserIntention } from '@/shared/account/introTypes';
import { IntentionPicker } from '../IntentionPicker';

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

const pressText = (root: ReactTestInstance, text: string) => {
  const button = root
    .findAll(
      (node) =>
        node.props.accessibilityRole === 'button' &&
        typeof node.props.onPress === 'function' &&
        textsOf(node).includes(text),
    )
    .at(-1);
  if (!button) throw new Error(`Botón con texto ${text} no encontrado`);
  const onPress = button.props.onPress as () => void;
  act(() => {
    onPress();
  });
  return button;
};

const render = (selected: UserIntention = 'explore') => {
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(
      <IntentionPicker selected={selected} onSelect={jest.fn()} onConfirm={jest.fn()} />,
    );
  });
  return renderer!.root as ReactTestInstance;
};

describe('IntentionPicker', () => {
  it('ofrece las cuatro intenciones', () => {
    const root = render();
    for (const id of ['goal', 'habit', 'agenda', 'explore']) {
      expect(textsOf(root)).toContain(`onboarding.intentions.${id}`);
    }
  });

  it('expone el grupo como radiogroup accesible', () => {
    const root = render();
    expect(
      root.findAll((node) => node.type === 'View' && node.props.accessibilityRole === 'radiogroup'),
    ).toHaveLength(1);
  });

  it('el preview muestra el contenido real del kit elegido', () => {
    // El default del hook es 'explore', que trae meta y hábito.
    const root = render('explore');
    const texts = textsOf(root);
    expect(texts).toContain('onboarding.seed.goalTitle');
    expect(texts).toContain('onboarding.seed.habitTitle');
  });

  it('el preview de intención meta no muestra un hábito', () => {
    const root = render('goal');
    const texts = textsOf(root);
    expect(texts).toContain('onboarding.seed.goalTitle');
    expect(texts).not.toContain('onboarding.seed.habitTitle');
  });

  it('el preview de intención hábito no muestra una meta', () => {
    const root = render('habit');
    const texts = textsOf(root);
    expect(texts).toContain('onboarding.seed.habitTitle');
    expect(texts).not.toContain('onboarding.seed.goalTitle');
  });

  it('el preview de agenda muestra el día ejemplo con su hora', () => {
    const root = render('agenda');
    const texts = textsOf(root);
    expect(texts).toContain('onboarding.seed.agendaGoalTitle');
    expect(texts).toContain('onboarding.seed.agendaHabitTitle');
  });

  it('avisa que es un ejemplo y se puede descartar', () => {
    const root = render();
    const texts = textsOf(root);
    expect(texts).toContain('onboarding.seed.hint');
    expect(texts).toContain('onboarding.seed.confirm');
  });

  it('devuelve la intención elegida', () => {
    const onSelect = jest.fn();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <IntentionPicker selected="explore" onSelect={onSelect} onConfirm={jest.fn()} />,
      );
    });
    const root = renderer!.root as ReactTestInstance;

    pressText(root, 'onboarding.intentions.agenda');

    expect(onSelect).toHaveBeenCalledWith('agenda');
  });

  it('el CTA confirma en vez de avanzar de paso', () => {
    const onConfirm = jest.fn();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <IntentionPicker selected="goal" onSelect={jest.fn()} onConfirm={onConfirm} />,
      );
    });
    const root = renderer!.root as ReactTestInstance;

    pressText(root, 'onboarding.seed.confirm');

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('marca sólo la opción seleccionada para lectores de pantalla', () => {
    const root = render('habit');
    // OnboardingButton reparte las props en varios niveles del árbol, así que
    // se comparan las etiquetas únicas y no la cantidad de nodos.
    const labels = new Set(
      root
        .findAll(
          (node) =>
            node.props.accessibilityRole === 'button' &&
            (node.props.accessibilityState as { selected?: boolean } | undefined)?.selected ===
              true,
        )
        .map((node) => node.props.accessibilityLabel as string),
    );
    expect([...labels]).toHaveLength(1);
    expect([...labels][0]).toContain('onboarding.intentions.habit');
  });
});
