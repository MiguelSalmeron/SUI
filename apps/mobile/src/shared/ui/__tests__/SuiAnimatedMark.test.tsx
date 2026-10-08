import { act, type ReactElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, AppState, type AppStateStatus } from 'react-native';
import { G, Path } from 'react-native-svg';
import { SuiAvatar } from '../SuiMark';
import { SuiAnimatedMark } from '../SuiAnimatedMark';

jest.mock('@/shared/theme/theme', () => ({
  useAppTheme: () => ({
    colors: {
      primary: '#218ECE',
      onPrimary: '#FFFFFF',
      primaryContainer: '#D4EEFF',
      surface: '#FFFFFF',
    },
  }),
}));
jest.mock('../motion/useReduceMotion', () => ({ useReduceMotion: jest.fn(() => false) }));
const reduceMotion = jest.requireMock('../motion/useReduceMotion').useReduceMotion as jest.Mock;
const avatarType = (SuiAvatar as unknown as { type: unknown }).type;

describe('SuiAnimatedMark, Fase 1', () => {
  let renderer: ReactTestRenderer & { update: (element: ReactElement) => void };
  let loop: { start: jest.Mock; stop: jest.Mock; reset: jest.Mock };
  let finish: ((result: { finished: boolean }) => void) | undefined;
  let flash: { start: jest.Mock; stop: jest.Mock; reset: jest.Mock };
  let changeAppState: (state: AppStateStatus) => void;
  let remove: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    reduceMotion.mockReturnValue(false);
    loop = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    flash = {
      start: jest.fn((callback) => {
        finish = callback;
      }),
      stop: jest.fn(),
      reset: jest.fn(),
    };
    finish = undefined;
    remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      changeAppState = callback;
      return { remove };
    });
    AppState.currentState = 'active';
    jest.spyOn(Animated, 'loop').mockReturnValue(loop);
    jest.spyOn(Animated, 'parallel').mockReturnValue(flash);
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const render = (winkSignal = 0, props = {}) => {
    act(() => {
      renderer = create(<SuiAnimatedMark winkSignal={winkSignal} {...props} />) as typeof renderer;
    });
  };
  const update = (winkSignal: number, props = {}) => {
    act(() => renderer.update(<SuiAnimatedMark winkSignal={winkSignal} {...props} />));
  };

  const face = () =>
    renderer.root.findAllByType(avatarType).find((node) => node.props.layer !== 'body')!;

  it('respira con halo, sin bloquear interacción ni animar atributos SVG', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render();
    expect(loop.start).toHaveBeenCalledTimes(1);
    expect(face().props.pose ?? 'idle').toBe('idle');
    expect(
      renderer.root.findAll((node) => node.props.testID === 'sui-animated-halo')[0],
    ).toBeDefined();
    expect(timing.mock.calls.map(([, config]) => config)).toEqual([
      expect.objectContaining({
        duration: 900,
        toValue: 1,
        useNativeDriver: true,
        isInteraction: false,
      }),
      expect.objectContaining({
        duration: 900,
        toValue: 0,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]);
  });

  it.each([true, null])('preferencia %s → SuiAvatar estático, cero animación', (preference) => {
    reduceMotion.mockReturnValue(preference);
    const timing = jest.spyOn(Animated, 'timing');
    render();
    update(1);
    expect(face()).toBeDefined();
    expect(timing).not.toHaveBeenCalled();
    expect(loop.start).not.toHaveBeenCalled();
    expect(flash.start).not.toHaveBeenCalled();
  });

  it('señal explícita → guiño 600ms; vuelve a idle sin reiniciar respiración', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render();
    expect(flash.start).not.toHaveBeenCalled();
    update(1);
    expect(face().props.pose).toBe('wink');
    expect(timing.mock.calls.slice(2).map(([, config]) => config.duration)).toEqual([
      120, 180, 120, 480,
    ]);
    act(() => finish?.({ finished: true }));
    expect(face().props.pose ?? 'idle').toBe('idle');
    expect(loop.start).toHaveBeenCalledTimes(1);
    update(1);
    expect(flash.start).toHaveBeenCalledTimes(1);
  });

  it('toques consecutivos cancelan guiño anterior; callback viejo no cambia pose', () => {
    render();
    update(1);
    const oldFinish = finish;
    update(2);
    expect(flash.stop).toHaveBeenCalledTimes(1);
    act(() => oldFinish?.({ finished: true }));
    expect(face().props.pose).toBe('wink');
  });

  it('background cancela movimiento; foreground retoma idle sin reproducir toque pendiente', () => {
    render();
    update(1);
    act(() => changeAppState('background'));
    expect(loop.stop).toHaveBeenCalledTimes(1);
    expect(flash.stop).toHaveBeenCalledTimes(1);
    expect(face()).toBeDefined();
    update(2);
    act(() => changeAppState('active'));
    expect(loop.start).toHaveBeenCalledTimes(2);
    expect(face().props.pose ?? 'idle').toBe('idle');
    expect(flash.start).toHaveBeenCalledTimes(1);
  });

  it('blur y kill-switch detienen animación; desmontaje limpia listener', () => {
    render();
    update(0, { active: false });
    expect(loop.stop).toHaveBeenCalledTimes(1);
    expect(face().props.pose ?? 'idle').toBe('idle');
    update(0, { enabled: false });
    expect(face()).toBeDefined();
    expect(loop.start).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('blur pausa respiración y deja terminar guiño durante navegación', () => {
    render();
    update(1, { active: false });
    expect(loop.stop).toHaveBeenCalledTimes(1);
    expect(face().props.pose).toBe('wink');
    act(() => finish?.({ finished: true }));
    expect(face().props.pose ?? 'idle').toBe('idle');
  });

  it('desmontaje durante guiño cancela loop, flash y callback pendiente', () => {
    render();
    update(1);
    const oldFinish = finish;
    act(() => renderer.unmount());
    expect(loop.stop).toHaveBeenCalledTimes(1);
    expect(flash.stop).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    act(() => oldFinish?.({ finished: true }));
  });

  it('cambio a Reduce Motion corta guiño/loop; callback tardío queda descartado', () => {
    render();
    update(1);
    const oldFinish = finish;
    reduceMotion.mockReturnValue(true);
    update(2);
    expect(loop.stop).toHaveBeenCalledTimes(1);
    expect(flash.stop).toHaveBeenCalledTimes(1);
    act(() => oldFinish?.({ finished: true }));
    expect(face()).toBeDefined();
  });

  it('gaze recorre izquierda, centro, derecha, arriba y centro con pausas naturales', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const timing = jest.spyOn(Animated, 'timing');
    jest
      .spyOn(Animated, 'sequence')
      .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
    render();
    const targets = [
      [-2, 0],
      [0, 0],
      [2, 0],
      [0, -1],
      [0, 0],
      [-2, 0],
    ];
    for (const target of targets) {
      act(() => jest.advanceTimersByTime(1750));
      expect(timing.mock.calls.slice(-2).map(([, config]) => config.toValue)).toEqual(target);
      expect(timing.mock.calls.slice(-2).map(([, config]) => config.duration)).toEqual([350, 350]);
      act(() => finish?.({ finished: true }));
    }
  });

  it('blink breve con jitter, pausa por wink y retorno autónomo sin callbacks tardíos', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const timing = jest.spyOn(Animated, 'timing');
    let blinkFinish: ((result: { finished: boolean }) => void) | undefined;
    const blinkStop = jest.fn();
    jest.spyOn(Animated, 'sequence').mockReturnValue({
      start: jest.fn((callback) => {
        blinkFinish = callback;
      }),
      stop: blinkStop,
      reset: jest.fn(),
    });
    render();
    act(() => jest.advanceTimersByTime(5499));
    expect(blinkFinish).toBeUndefined();
    act(() => jest.advanceTimersByTime(1));
    expect(
      timing.mock.calls.slice(-2).map(([, config]) => [config.toValue, config.duration]),
    ).toEqual([
      [0.08, 70],
      [1, 100],
    ]);
    const oldBlinkFinish = blinkFinish;
    update(1);
    expect(blinkStop).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(1));
    expect(jest.getTimerCount()).toBe(0);
    act(() => oldBlinkFinish?.({ finished: true }));
    act(() => jest.advanceTimersByTime(1));
    expect(jest.getTimerCount()).toBe(0);
    act(() => finish?.({ finished: true }));
    act(() => jest.advanceTimersByTime(1));
    expect(jest.getTimerCount()).toBe(2);
    act(() => renderer.unmount());
    act(() => jest.advanceTimersByTime(1));
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([true, null])('preferencia %s no agenda gaze ni blink', (preference) => {
    reduceMotion.mockReturnValue(preference);
    render();
    act(() => jest.advanceTimersByTime(1));
    expect(jest.getTimerCount()).toBe(0);
    update(1);
    act(() => jest.advanceTimersByTime(20000));
    expect(flash.start).not.toHaveBeenCalled();
  });

  it('background limpia gaze/blink; callback de gaze cancelado no revive timers', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    render();
    act(() => jest.advanceTimersByTime(1750));
    const oldFinish = finish;
    act(() => changeAppState('background'));
    act(() => jest.advanceTimersByTime(1));
    expect(jest.getTimerCount()).toBe(0);
    act(() => oldFinish?.({ finished: true }));
    act(() => jest.advanceTimersByTime(1));
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['#FFFFFF', '#06283A'])('ambos ojos y guiño usan token explícito %s', (eyeColor) => {
    const theme = jest.requireMock('@/shared/theme/theme');
    jest.spyOn(theme, 'useAppTheme').mockReturnValue({
      colors: { primary: '#218ECE', primaryContainer: '#D4EEFF', onPrimary: eyeColor },
    });
    render();
    const eyePaths = renderer.root
      .findAllByType(Path)
      .filter((node) => (node.props.d as string).startsWith('M-10.5'));
    expect(eyePaths.map((node) => node.props.fill)).toEqual([eyeColor, eyeColor]);
    update(1);
    const eyelid = renderer.root.findAllByType(Path).find((node) => node.props.stroke);
    expect(eyelid?.props.stroke).toBe(eyeColor);
  });
  it.each(['think', 'read', 'warm', 'concern'] as const)(
    'pose %s apaga autonomía; concern también respira quieto',
    (pose) => {
      jest.spyOn(Animated, 'sequence').mockReturnValue({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn(),
      });
      render(0, { pose });
      expect(face().props.pose).toBe(pose);
      expect(loop.start).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('listen cambia cadencia; pensar detiene respiración y autonomía', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render();
    update(0, { pose: 'listen' });
    expect(loop.stop).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls.slice(-2).map(([, config]) => config.duration)).toEqual([600, 600]);
    update(0, { pose: 'think' });
    expect(loop.stop).toHaveBeenCalledTimes(2);
    act(() => jest.advanceTimersByTime(1));
    expect(jest.getTimerCount()).toBe(0);
  });

  it('read hace un barrido finito, sin loop; cambio de estado cancela barrido', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const scan = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    jest.spyOn(Animated, 'sequence').mockReturnValue(scan);
    render(0, { pose: 'read' });
    expect(scan.start).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls.map(([, config]) => config.toValue)).toEqual([-2, 2, 0]);
    expect(loop.start).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    update(0, { pose: 'concern' });
    expect(scan.stop).toHaveBeenCalledTimes(1);
    expect(scan.start).toHaveBeenCalledTimes(1);
  });

  it('warm asienta una vez; background o cambio de preferencia no repiten gesto', () => {
    const spring = jest.spyOn(Animated, 'spring');
    render(0, { pose: 'think' });
    update(0, { pose: 'warm' });
    expect(spring).toHaveBeenCalledTimes(1);
    expect(spring.mock.calls[0][1]).toEqual(
      expect.objectContaining({ speed: 12, bounciness: 6, isInteraction: false }),
    );
    act(() => changeAppState('background'));
    expect(flash.stop).toHaveBeenCalledTimes(1);
    act(() => changeAppState('active'));
    expect(spring).toHaveBeenCalledTimes(1);
    reduceMotion.mockReturnValue(true);
    update(0, { pose: 'warm' });
    reduceMotion.mockReturnValue(false);
    update(0, { pose: 'warm' });
    expect(spring).toHaveBeenCalledTimes(1);
  });

  it('speaking en background consume señal sin reproducirla al volver', () => {
    const spring = jest.spyOn(Animated, 'spring');
    render(0, { pose: 'speak' });
    update(0, { pose: 'speak', speakSignal: 1 });
    expect(spring).toHaveBeenCalledTimes(1);
    act(() => changeAppState('background'));
    update(0, { pose: 'speak', speakSignal: 2 });
    act(() => changeAppState('active'));
    expect(spring).toHaveBeenCalledTimes(1);
    update(0, { pose: 'speak', speakSignal: 3 });
    expect(spring).toHaveBeenCalledTimes(2);
  });

  it('crisis corta respiración, timers y rebote anterior', () => {
    const gesture = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    jest.spyOn(Animated, 'sequence').mockReturnValue(gesture);
    render(0, { pose: 'speak', speakSignal: 0 });
    update(0, { pose: 'speak', speakSignal: 1 });
    expect(gesture.start).toHaveBeenCalledTimes(1);
    update(0, { pose: 'concern', speakSignal: 1 });
    expect(gesture.stop).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(1));
    expect(jest.getTimerCount()).toBe(0);
    expect(face().props.pose).toBe('concern');
  });

  it('señales speak consecutivas cancelan rebote, spring compartido; misma señal no repite', () => {
    const spring = jest.spyOn(Animated, 'spring');
    const gesture = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    jest.spyOn(Animated, 'sequence').mockReturnValue(gesture);
    render(0, { pose: 'speak', speakSignal: 0, size: 36 });
    update(0, { pose: 'speak', speakSignal: 1, size: 36 });
    expect(face().props.size).toBe(36);
    expect(spring).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        speed: 40,
        bounciness: 14,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    update(0, { pose: 'speak', speakSignal: 2, size: 36 });
    expect(gesture.stop).toHaveBeenCalledTimes(1);
    expect(gesture.start).toHaveBeenCalledTimes(2);
    update(0, { pose: 'speak', speakSignal: 2, size: 36 });
    expect(gesture.start).toHaveBeenCalledTimes(2);
    act(() => renderer.unmount());
    expect(gesture.stop).toHaveBeenCalledTimes(2);
  });

  it.each([true, null])(
    'preferencia %s conserva pose controlada y tamaño sin animar',
    (preference) => {
      reduceMotion.mockReturnValue(preference);
      const spring = jest.spyOn(Animated, 'spring');
      render(0, { pose: 'warm', size: 36 });
      expect(face().props.pose).toBe('warm');
      expect(face().props.size).toBe(36);
      update(0, { pose: 'speak', speakSignal: 1, size: 36 });
      expect(spring).not.toHaveBeenCalled();
      expect(loop.start).not.toHaveBeenCalled();
    },
  );

  it('poses nuevas transforman geometría existente; warm cierra ambos ojos sin trazado wink', () => {
    reduceMotion.mockReturnValue(true);
    render(0, { pose: 'warm' });
    const groups = renderer.root.findAllByType(G);
    expect(groups.filter((node) => node.props.transform === 'scale(1 0.12)')).toHaveLength(2);
    expect(renderer.root.findAllByType(Path).map((node) => node.props.d)).toHaveLength(3);
    expect(renderer.root.findAllByType(Path).some((node) => node.props.d === 'M-11 0 H11')).toBe(
      false,
    );
    update(0, { pose: 'think' });
    expect(
      renderer.root.findAllByType(G).some((node) => node.props.transform === 'translate(0 -5)'),
    ).toBe(true);
    expect(
      renderer.root.findAllByType(G).filter((node) => node.props.transform === 'scale(1 0.82)'),
    ).toHaveLength(2);
    update(0, { pose: 'read' });
    expect(
      renderer.root.findAllByType(G).some((node) => node.props.transform === 'translate(0 4)'),
    ).toBe(true);
    update(0, { pose: 'concern' });
    expect(
      renderer.root.findAllByType(G).some((node) => node.props.transform === 'translate(0 4)'),
    ).toBe(true);
  });
});
