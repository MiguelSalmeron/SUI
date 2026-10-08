import { render } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { CelebrationToast } from '../CelebrationToast';
import { MOTION } from '@/shared/ui/motion/motionTokens';

jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/i18n/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
jest.mock('@/shared/theme/theme', () => ({
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24 },
  useAppTheme: () => ({
    colors: { flame: 'flame', onFlame: 'onFlame' },
    type: { brandTitle: {}, labelMd: {} },
  }),
}));
jest.mock('@/shared/domain/productivity/public', () => ({
  useCelebrationStore: (selector: (state: object) => unknown) =>
    selector({ visible: true, kind: 'goal', subtitle: '' }),
}));
jest.mock('@/shared/ui/motion/useReduceMotion', () => ({ useReduceMotion: jest.fn(() => false) }));
const reduceMotion = jest.requireMock('@/shared/ui/motion/useReduceMotion')
  .useReduceMotion as jest.Mock;

describe('CelebrationToast', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([true, null, false])(
    'preferencia %s → rebote sólo cuando movimiento permitido',
    async (preference) => {
      reduceMotion.mockReturnValue(preference);
      const spring = jest.spyOn(Animated, 'spring');
      const screen = await render(<CelebrationToast />);
      expect(screen.getByText('celebration.goal')).toBeTruthy();
      if (preference === false) {
        expect(spring).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining(MOTION.springs.settle),
        );
      } else {
        expect(spring).not.toHaveBeenCalled();
        const wrap = screen.getByText('celebration.goal').parent?.parent?.parent;
        expect(wrap?.props.style.transform).toBeUndefined();
      }
    },
  );

  it('cambio de preferencia y desmontaje detienen animación anterior', async () => {
    reduceMotion.mockReturnValue(false);
    const animation = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    jest.spyOn(Animated, 'parallel').mockReturnValue(animation);
    const screen = await render(<CelebrationToast />);
    reduceMotion.mockReturnValue(true);
    await screen.rerender(<CelebrationToast />);
    expect(animation.stop).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });
});
