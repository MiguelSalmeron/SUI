import { act, render } from '@testing-library/react-native';
import { Animated, AppState, type AppStateStatus } from 'react-native';
import { StreamingCursor } from '../StreamingCursor';

jest.mock('@/shared/theme/theme', () => ({
  useAppTheme: () => ({
    colors: { secondary: 'secondary' },
    type: jest.requireActual('@/shared/theme/typography').TYPOGRAPHY,
  }),
}));
jest.mock('@/shared/ui/motion/useReduceMotion', () => ({ useReduceMotion: jest.fn(() => false) }));
const reduceMotion = jest.requireMock('@/shared/ui/motion/useReduceMotion')
  .useReduceMotion as jest.Mock;

describe('StreamingCursor', () => {
  let loop: { start: jest.Mock; stop: jest.Mock; reset: jest.Mock };
  let changeAppState: (state: AppStateStatus) => void;
  const remove = jest.fn();
  beforeEach(() => {
    reduceMotion.mockReturnValue(false);
    AppState.currentState = 'active';
    loop = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    jest.spyOn(Animated, 'loop').mockReturnValue(loop);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      changeAppState = callback;
      return { remove };
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('cursor real, decorativo, native driver; background y desmontaje limpian loop', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const screen = await render(<StreamingCursor />);
    const cursor = screen.getByTestId('streaming-cursor', { includeHiddenElements: true });
    expect(cursor.props.style).toEqual(
      expect.objectContaining({ width: 2, height: 24, backgroundColor: 'secondary' }),
    );
    expect(cursor.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(timing.mock.calls.map(([, config]) => config)).toEqual([
      expect.objectContaining({
        toValue: 0.25,
        duration: 600,
        useNativeDriver: true,
        isInteraction: false,
      }),
      expect.objectContaining({
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]);
    await act(async () => changeAppState('background'));
    expect(loop.stop).toHaveBeenCalledTimes(1);
    await act(async () => changeAppState('active'));
    expect(loop.start).toHaveBeenCalledTimes(2);
    await screen.unmount();
    expect(loop.stop).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalled();
  });

  it.each([true, null])('preferencia %s → estático; cambio cancela loop', async (preference) => {
    const screen = await render(<StreamingCursor />);
    reduceMotion.mockReturnValue(preference);
    await screen.rerender(<StreamingCursor />);
    expect(loop.stop).toHaveBeenCalledTimes(1);
    await screen.unmount();
    const timing = jest.spyOn(Animated, 'timing');
    await render(<StreamingCursor />);
    expect(timing).not.toHaveBeenCalled();
  });
});
