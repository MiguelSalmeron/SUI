/**
 * Aviso para retomar tras varios días sin avanzar.
 *
 * Se verifica lo que pide el carril: aparece con la racha rota, no aparece
 * con la racha viva, el cálculo usa el día local y el descarte dura la sesión
 * a nivel de módulo (no vuelve al remontar, sí en un módulo nuevo).
 */

import { localDateKey } from '@/shared/domain/productivity/pure';

jest.mock('@/shared/theme/theme', () => {
  const leaf = new Proxy({}, { get: () => '#000' });
  const textStyle = new Proxy({}, { get: () => ({}) });
  return {
    SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    useAppTheme: () => ({
      scheme: 'light',
      colors: leaf,
      radius: { full: 999, lg: 12, xl: 16 },
      type: textStyle,
    }),
  };
});
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({
    locale: 'es',
    t: (key: string, values?: Record<string, string | number>) =>
      values?.days !== undefined ? `${key}:${values.days}` : key,
  }),
}));
jest.mock('@/shared/ui/Ionicons', () => ({
  Ionicons: Object.assign(() => null, { glyphMap: {} }),
}));

import { getResumeGapDays } from '../ResumeNudge';

const NOON = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);
const keyOf = (date: Date) => localDateKey(date);

interface NudgeProps {
  lastCompletedDate?: string | null;
  now?: Date;
  onStart?: () => void;
}

interface MountedNudge {
  visible: () => boolean;
  texts: () => string;
  press: (label: string) => void;
  unmount: () => void;
  buttons: () => { label: string; minHeight: number }[];
  cardProps: () => Record<string, unknown>;
  iconHidden: () => boolean;
}

/**
 * Monta el componente dentro de un registry fresco.
 *
 * Todo (React, test-renderer y el aviso) se carga en el mismo
 * `isolateModules`, así los hooks comparten una sola copia de React y el
 * descarte parte sin marcar. Lo devuelto son cierres que siguen usando esas
 * instancias frescas aunque el bloque ya haya salido.
 */
const mountIsolated = (props: NudgeProps): MountedNudge => {
  let handle: MountedNudge | null = null;
  jest.isolateModules(() => {
    const ReactFresh = require('react') as typeof import('react');
    const TT = require('react-test-renderer') as typeof import('react-test-renderer');
    const mod = require('../ResumeNudge') as typeof import('../ResumeNudge');
    let renderer: import('react-test-renderer').ReactTestRenderer;
    ReactFresh.act(() => {
      renderer = TT.create(
        ReactFresh.createElement(mod.ResumeNudge, {
          lastCompletedDate: props.lastCompletedDate,
          now: props.now,
          onStart: props.onStart ?? jest.fn(),
        }),
      );
    });
    const getRoot = () => renderer!.root;
    const findCard = () =>
      getRoot().findAll((node) => node.props?.testID === 'resume-nudge');
    handle = {
      visible: () => findCard().length > 0,
      texts: () =>
        getRoot()
          .findAllByType('Text')
          .map((node) => {
            const children = (node.props as { children?: unknown }).children;
            if (typeof children === 'string') return children;
            if (Array.isArray(children))
              return children.filter((c) => typeof c === 'string').join('');
            return '';
          })
          .join(' '),
      press: (label: string) => {
        const node = getRoot().findAll(
          (candidate) =>
            candidate.props?.accessibilityRole === 'button' &&
            candidate.props?.accessibilityLabel === label &&
            typeof candidate.props?.onPress === 'function',
        )[0];
        if (!node) throw new Error(`Botón ${label} no encontrado`);
        ReactFresh.act(() => {
          (node.props.onPress as () => void)();
        });
      },
      unmount: () => {
        ReactFresh.act(() => {
          renderer!.unmount();
        });
      },
      buttons: () =>
        getRoot()
          .findAll(
            (node) =>
              node.props?.accessibilityRole === 'button' &&
              typeof node.props?.onPress === 'function',
          )
          .map((node) => {
            const style = node.props.style;
            const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
            return {
              label: node.props.accessibilityLabel as string,
              minHeight: (flat as { minHeight?: number }).minHeight ?? 0,
            };
          }),
      cardProps: () => {
        const card = findCard()[0];
        if (!card) throw new Error('Tarjeta resume-nudge no encontrada');
        return card.props as Record<string, unknown>;
      },
      iconHidden: () =>
        getRoot().findAll(
          (node) =>
            node.props?.accessibilityElementsHidden === true ||
            node.props?.importantForAccessibility === 'no-hide-descendants',
        ).length > 0,
    };
  });
  if (!handle) throw new Error('No se pudo montar el aviso aislado');
  return handle;
};

describe('getResumeGapDays', () => {
  const now = NOON(2026, 9, 10);

  it('hoy es 0 y ayer es 1', () => {
    expect(getResumeGapDays(keyOf(now), now)).toBe(0);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getResumeGapDays(keyOf(yesterday), now)).toBe(1);
  });

  it('cuenta los días desde una fecha anterior a ayer', () => {
    const fiveAgo = new Date(now);
    fiveAgo.setDate(fiveAgo.getDate() - 5);
    expect(getResumeGapDays(keyOf(fiveAgo), now)).toBe(5);
  });

  it('sin fecha o con fecha inválida devuelve null; futura queda en 0', () => {
    expect(getResumeGapDays(undefined, now)).toBeNull();
    expect(getResumeGapDays(null, now)).toBeNull();
    expect(getResumeGapDays('no-fecha', now)).toBeNull();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(getResumeGapDays(keyOf(tomorrow), now)).toBe(0);
  });
});

describe('ResumeNudge', () => {
  const now = NOON(2026, 9, 10);

  it('no aparece con la racha viva ni sin historia', () => {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(mountIsolated({ lastCompletedDate: keyOf(now), now }).visible()).toBe(false);
    expect(mountIsolated({ lastCompletedDate: keyOf(yesterday), now }).visible()).toBe(false);
    expect(mountIsolated({ lastCompletedDate: undefined, now }).visible()).toBe(false);
  });

  it('aparece con la racha rota y muestra los días', () => {
    const fiveAgo = new Date(now);
    fiveAgo.setDate(fiveAgo.getDate() - 5);
    const mounted = mountIsolated({ lastCompletedDate: keyOf(fiveAgo), now });
    expect(mounted.visible()).toBe(true);
    expect(mounted.texts()).toContain('settings.resumeNudge.body:5');
    expect(mounted.texts()).toContain('settings.resumeNudge.start');
  });

  it('el cuerpo se lee como texto normal y el ícono queda oculto', () => {
    const fiveAgo = new Date(now);
    fiveAgo.setDate(fiveAgo.getDate() - 5);
    const mounted = mountIsolated({ lastCompletedDate: keyOf(fiveAgo), now });
    const props = mounted.cardProps();
    expect(props.accessible).toBeUndefined();
    expect(props.accessibilityLabel).toBeUndefined();
    expect(props.accessibilityRole).toBeUndefined();
    expect(mounted.texts()).toContain('settings.resumeNudge.body:5');
    expect(mounted.iconHidden()).toBe(true);
  });

  it('Empezar llama a onStart y queda descartado en la sesión', () => {
    const fiveAgo = new Date(now);
    fiveAgo.setDate(fiveAgo.getDate() - 3);
    const onStart = jest.fn();
    const mounted = mountIsolated({ lastCompletedDate: keyOf(fiveAgo), now, onStart });
    mounted.press('settings.resumeNudge.start');
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(mounted.visible()).toBe(false);
  });

  it('no reaparece al volver a montar en el mismo módulo', () => {
    let secondVisible: boolean | null = null;
    jest.isolateModules(() => {
        const ReactFresh = require('react') as typeof import('react');
        const TT = require('react-test-renderer') as typeof import('react-test-renderer');
        const mod = require('../ResumeNudge') as typeof import('../ResumeNudge');
      const fiveAgo = new Date(now);
      fiveAgo.setDate(fiveAgo.getDate() - 4);
      let first: import('react-test-renderer').ReactTestRenderer;
      ReactFresh.act(() => {
        first = TT.create(
          ReactFresh.createElement(mod.ResumeNudge, {
            lastCompletedDate: keyOf(fiveAgo),
            now,
            onStart: jest.fn(),
          }),
        );
      });
      const dismiss = first!.root.findAll(
        (candidate) =>
          candidate.props?.accessibilityRole === 'button' &&
          candidate.props?.accessibilityLabel === 'settings.resumeNudge.dismiss' &&
          typeof candidate.props?.onPress === 'function',
      )[0];
      ReactFresh.act(() => {
        (dismiss.props.onPress as () => void)();
      });
      expect(first!.root.findAll((node) => node.props?.testID === 'resume-nudge').length).toBe(
        0,
      );
      ReactFresh.act(() => {
        first!.unmount();
      });
      let second: import('react-test-renderer').ReactTestRenderer;
      ReactFresh.act(() => {
        second = TT.create(
          ReactFresh.createElement(mod.ResumeNudge, {
            lastCompletedDate: keyOf(fiveAgo),
            now,
            onStart: jest.fn(),
          }),
        );
      });
      secondVisible =
        second!.root.findAll((node) => node.props?.testID === 'resume-nudge').length > 0;
    });
    expect(secondVisible).toBe(false);
  });

  it('sí reaparece en un módulo nuevo', () => {
    const fiveAgo = new Date(now);
    fiveAgo.setDate(fiveAgo.getDate() - 4);
    const first = mountIsolated({ lastCompletedDate: keyOf(fiveAgo), now });
    first.press('settings.resumeNudge.dismiss');
    expect(first.visible()).toBe(false);
    const second = mountIsolated({ lastCompletedDate: keyOf(fiveAgo), now });
    expect(second.visible()).toBe(true);
  });

  it('ambos botones se encuentran por rol y etiqueta, con alvo de 44 dp', () => {
    const fiveAgo = new Date(now);
    fiveAgo.setDate(fiveAgo.getDate() - 6);
    const mounted = mountIsolated({ lastCompletedDate: keyOf(fiveAgo), now });
    const labels = mounted.buttons().map((item) => item.label);
    expect(labels).toContain('settings.resumeNudge.start');
    expect(labels).toContain('settings.resumeNudge.dismiss');
    for (const button of mounted.buttons()) {
      expect(typeof button.label).toBe('string');
      expect(button.minHeight).toBeGreaterThanOrEqual(44);
    }
  });
});
