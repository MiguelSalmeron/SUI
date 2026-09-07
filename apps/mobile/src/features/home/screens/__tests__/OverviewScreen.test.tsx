import { fireEvent, render } from '@testing-library/react-native';

// La tarjeta real basta aquí; el barrel completo arrastra el motor y
// expo-notifications (ESM) fuera del alcance de jest.
jest.mock('@/features/pomodoro/public', () => {
  const { PomodoroCard } = jest.requireActual('../../../pomodoro/components/PomodoroCard');
  return { PomodoroCard };
});

const mockNavigation = { navigate: jest.fn() };
const mockState = {
  stateLoaded: true,
  goals: [],
  habits: [],
  streak: 0,
  totalXp: 0,
  toggleHabit: jest.fn(),
  toggleGoal: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => mockNavigation,
}));
jest.mock('@/features/calendar/public', () => ({
  buildUnifiedTimeline: () => [],
  loadCachedGoogleEvents: () => Promise.resolve([]),
}));
jest.mock('@/shared/domain/productivity/public', () => ({
  localDateKey: () => '2026-09-01',
  useProductivityStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    formatDate: () => 'martes, 1 de septiembre',
  }),
}));
jest.mock('@/shared/theme/theme', () => {
  const colors = new Proxy({}, { get: () => '#000' });
  const radius = new Proxy({}, { get: () => 8 });
  const type = new Proxy({}, { get: () => ({}) });
  return {
    SCREEN_CONTENT_BOTTOM_PADDING: 80,
    SCREEN_MAX_CONTENT_WIDTH: 560,
    SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    useAppTheme: () => ({ colors, radius, type }),
  };
});
jest.mock('@/shared/ui/Ionicons', () => ({
  Ionicons: Object.assign(() => null, { glyphMap: {} }),
}));
jest.mock('@/shared/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/shared/ui/SuiDoodle', () => ({ SuiDoodle: () => null }));

import { OverviewScreen } from '../OverviewScreen';

describe('OverviewScreen vacío', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockState.goals = [];
    mockState.habits = [];
    // Deja terminar la hidratación asíncrona del store de Pomodoro.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('muestra fecha y dos CTA; oculta analítica, agenda y Pomodoro', async () => {
    const screen = await render(<OverviewScreen />);

    expect(screen.getByText('martes, 1 de septiembre')).toBeTruthy();
    expect(screen.getByText('home.emptyTitle')).toBeTruthy();
    expect(screen.getByText('home.firstGoal')).toBeTruthy();
    expect(screen.getByText('home.firstHabit')).toBeTruthy();
    expect(screen.queryByText('home.next')).toBeNull();
    expect(screen.queryByText('home.dailyProgress')).toBeNull();
    expect(screen.queryByText('home.agenda')).toBeNull();
    expect(screen.queryByTestId('pomodoro-card')).toBeNull();
  });

  it('muestra la tarjeta Pomodoro con datos y abre la sesión', async () => {
    mockState.goals = [{ id: 'goal-1', title: 'Entregar', completed: false } as never];

    const screen = await render(<OverviewScreen />);

    const card = screen.getByTestId('pomodoro-card');
    expect(card).toBeTruthy();
    fireEvent.press(card);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Pomodoro');
  });

  it('abre creación desde CTA', async () => {
    const screen = await render(<OverviewScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'home.firstGoal' }));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Goals', { create: true });
  });
});
