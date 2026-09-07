// `productivity/public` arrastra firebase (ESM) fuera del alcance de jest;
// se reemplaza por sus submódulos ligeros reales.
jest.mock('@/shared/domain/productivity/public', () => ({
  ...jest.requireActual('@/shared/domain/productivity/model/homeStorage'),
  ...jest.requireActual('@/shared/domain/productivity/store/useCelebrationStore'),
}));

jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/shared/theme/theme', () => {
  const colors = new Proxy({}, { get: () => '#000000' });
  const radius = new Proxy({}, { get: () => 12 });
  const type = new Proxy({}, { get: () => ({}) });
  return {
    SCREEN_CONTENT_BOTTOM_PADDING: 80,
    SCREEN_MAX_CONTENT_WIDTH: 560,
    SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    useAppTheme: () => ({ colors, radius, type }),
  };
});

jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));

import { fireEvent, render } from '@testing-library/react-native';
import { localDateKey } from '@/shared/domain/productivity/public';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { PomodoroCard } from '../PomodoroCard';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const baseState = () => ({
  minutes: 25,
  notifyOnComplete: false,
  secondsLeft: 1500,
  running: false,
  targetEndTime: null,
  dayKey: localDateKey(),
  sessions: 0,
  focusMinutes: 0,
});

describe('PomodoroCard', () => {
  beforeEach(async () => {
    // Deja que la hidratación asíncrona de persist termine antes de renderizar.
    await flush();
    usePomodoroStore.setState(baseState());
  });

  it('en reposo muestra duración y sin contador de sesiones', async () => {
    const view = await render(<PomodoroCard onPress={jest.fn()} />);

    expect(view.getByText('pomodoro.title')).toBeTruthy();
    expect(view.getByText('25:00')).toBeTruthy();
    expect(view.getByText('pomodoro.cardIdle')).toBeTruthy();
    expect(view.queryByText('pomodoro.sessionsTodayMany')).toBeNull();
  });

  it('muestra chip cuando hay sesiones hoy', async () => {
    usePomodoroStore.setState({ sessions: 3 });
    const view = await render(<PomodoroCard onPress={jest.fn()} />);

    expect(view.getByText('pomodoro.sessionsTodayMany')).toBeTruthy();
  });

  it('en sesión activa muestra la cuenta regresiva restante', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T10:00:00.000Z'));
    usePomodoroStore.setState({
      running: true,
      targetEndTime: Date.now() + 65_000,
      secondsLeft: 65,
    });

    const view = await render(<PomodoroCard onPress={jest.fn()} />);

    expect(view.getByText('pomodoro.cardActive')).toBeTruthy();
    expect(view.getByText('01:05')).toBeTruthy();
    jest.useRealTimers();
  });

  it('abre la sesión al tocar la tarjeta', async () => {
    const onPress = jest.fn();
    const view = await render(<PomodoroCard onPress={onPress} />);

    fireEvent.press(view.getByTestId('pomodoro-card'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
