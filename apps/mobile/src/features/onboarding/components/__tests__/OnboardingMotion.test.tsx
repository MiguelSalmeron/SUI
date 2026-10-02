import { act, type ReactElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, AppState, TouchableOpacity, type AppStateStatus } from 'react-native';
import { useReduceMotion } from '@/shared/ui/motion/useReduceMotion';
import { OnboardingButton } from '../OnboardingMotion';

jest.mock('@/shared/ui/motion/useReduceMotion', () => ({ useReduceMotion: jest.fn() }));

type Renderer = ReactTestRenderer & { update: (element: ReactElement) => void };

const motion = jest.mocked(useReduceMotion);
const animation = () => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });

describe('Pulso del botón de bienvenida', () => {
  let renderer: Renderer | undefined;
  let onChange: (state: AppStateStatus) => void;
  let remove: jest.Mock;
  let pulse: ReturnType<typeof animation>;
  const originalAppState = AppState.currentState;

  beforeEach(() => {
    motion.mockReturnValue(false);
    AppState.currentState = 'active';
    remove = jest.fn();
    pulse = animation();
    jest.spyOn(Animated, 'loop').mockReturnValue(pulse);
    jest.spyOn(Animated, 'timing').mockReturnValue(animation());
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      onChange = listener as (state: AppStateStatus) => void;
      return { remove };
    });
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    AppState.currentState = originalAppState;
    jest.restoreAllMocks();
  });

  const render = (attention = true, disabled = false) => {
    act(() => {
      renderer = create(<OnboardingButton attention={attention} disabled={disabled} />) as Renderer;
    });
  };

  it('palpita con app activa mediante animación nativa', () => {
    render();
    expect(pulse.start).toHaveBeenCalledTimes(1);
    for (const [, config] of jest.mocked(Animated.timing).mock.calls) {
      expect(config.useNativeDriver).toBe(true);
    }
  });

  it.each([true, null])('permanece quieto con reducción de movimiento %s', (preference) => {
    motion.mockReturnValue(preference);
    render();
    expect(Animated.loop).not.toHaveBeenCalled();
    expect(Animated.timing).not.toHaveBeenCalled();
  });

  it('otros botones permanecen quietos', () => {
    render(false);
    expect(Animated.loop).not.toHaveBeenCalled();
  });

  it('botón deshabilitado permanece quieto', () => {
    render(true, true);
    expect(Animated.loop).not.toHaveBeenCalled();
  });

  it('detiene pulso en segundo plano y lo retoma al volver', () => {
    render();
    act(() => onChange('background'));
    expect(pulse.stop).toHaveBeenCalledTimes(1);
    act(() => onChange('active'));
    expect(pulse.start).toHaveBeenCalledTimes(2);
  });

  it('espera app activa antes de iniciar pulso', () => {
    AppState.currentState = 'background';
    render();
    expect(pulse.start).not.toHaveBeenCalled();
    act(() => onChange('active'));
    expect(pulse.start).toHaveBeenCalledTimes(1);
  });

  it('detiene pulso cuando pantalla pierde foco', () => {
    render();
    act(() => renderer?.update(<OnboardingButton attention={false} />));
    expect(pulse.stop).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('cede al toque y conserva callbacks del botón', () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    act(() => {
      renderer = create(
        <OnboardingButton attention onPressIn={onPressIn} onPressOut={onPressOut} />,
      ) as Renderer;
    });
    const button = renderer!.root.findAllByType(TouchableOpacity)[0];
    const pressIn = button.props.onPressIn as (event: unknown) => void;
    const pressOut = button.props.onPressOut as (event: unknown) => void;
    act(() => pressIn({ nativeEvent: {} }));
    expect(pulse.stop).toHaveBeenCalledTimes(1);
    expect(onPressIn).toHaveBeenCalledTimes(1);
    act(() => pressOut({ nativeEvent: {} }));
    expect(pulse.start).toHaveBeenCalledTimes(2);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it('libera animación y listener al desmontar', () => {
    render();
    act(() => renderer?.unmount());
    renderer = undefined;
    expect(pulse.stop).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
