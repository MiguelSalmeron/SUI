import { fireEvent, render, within } from '@testing-library/react-native';
import { localDateKey } from '@/shared/domain/productivity/pure';
import type { Goal, Habit } from '@/shared/types/models';

const mockPomodoro = { running: false, setFocusTarget: jest.fn() };

// La tarjeta real basta aquí; el barrel completo arrastra el motor y
// expo-notifications (ESM) fuera del alcance de jest. Del store sólo se usa
// `getState` al enfocar, así que alcanza con un doble chiquito.
jest.mock('@/features/pomodoro/public', () => {
  const { PomodoroCard } = jest.requireActual('../../../pomodoro/components/PomodoroCard');
  return { PomodoroCard, usePomodoroStore: { getState: () => mockPomodoro } };
});

const mockNavigation = { navigate: jest.fn() };
const mockState = {
  localLoaded: true,
  goals: [] as Goal[],
  habits: [] as Habit[],
  streak: 0,
  totalXp: 0,
  lastCompletedDate: undefined as string | undefined,
  toggleHabit: jest.fn(),
  toggleGoal: jest.fn(),
  isSeeded: jest.fn(() => false),
  personalizeSeeded: jest.fn(),
  dismissSeeded: jest.fn(),
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
    t: (key: string, values?: Record<string, string | number>) =>
      values ? `${key}|${Object.values(values).join(',')}` : key,
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
    mockState.goals = [
      { id: 'goal-1', title: 'Entregar', completed: false, milestones: [] } as never,
    ];

    const screen = await render(<OverviewScreen />);

    const card = screen.getByTestId('pomodoro-card');
    expect(card).toBeTruthy();
    await fireEvent.press(card);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Pomodoro');
  });

  it('abre creación desde CTA', async () => {
    const screen = await render(<OverviewScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'home.firstGoal' }));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Goals', { create: true });
  });
});

describe('OverviewScreen con plan del día', () => {
  // Sólo se congela `Date`: los timers reales siguen para que el render
  // asíncrono y la hidratación de Pomodoro terminen como en la app.
  const now = new Date(2026, 9, 4, 10, 0);
  const dayIn = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return localDateKey(date);
  };
  const goal = (overrides: Partial<Goal>): Goal => ({
    id: 'g',
    title: 'Meta',
    deadline: dayIn(30),
    progress: 0,
    milestones: [],
    completed: false,
    gravity: 'low',
    createdAt: '2026-10-01',
    ...overrides,
  });
  const habit = (overrides: Partial<Habit>): Habit => ({
    id: 'h',
    title: 'Hábito',
    completed: false,
    frequency: 'daily',
    streak: 0,
    createdAt: '2026-10-01',
    ...overrides,
  });
  // Cuatro candidatos para comprobar que el tope de 3 lo respeta la pantalla.
  const fullDay = () => {
    mockState.goals = [
      goal({
        id: 'g-a',
        title: 'Preparar demo',
        deadline: dayIn(1),
        milestones: [{ id: 'm1', title: 'Definir alcance', completed: false }],
      }),
      goal({ id: 'g-b', title: 'Entregar informe', deadline: dayIn(3) }),
      goal({
        id: 'g-c',
        title: 'Aprender guitarra',
        milestones: [{ id: 'm9', title: 'Comprar cuerdas', completed: false }],
      }),
    ];
    mockState.habits = [habit({ id: 'h1', title: 'Leer' })];
  };

  beforeEach(async () => {
    jest.useFakeTimers({
      now,
      doNotFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'nextTick',
        'queueMicrotask',
      ],
    });
    jest.clearAllMocks();
    mockPomodoro.running = false;
    mockState.lastCompletedDate = undefined;
    fullDay();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('muestra hasta 3 pasos en el orden de buildDayPlan, con origen y vencimiento', async () => {
    const screen = await render(<OverviewScreen />);

    const steps = screen.getAllByTestId('today-plan-step');
    expect(steps).toHaveLength(3);
    expect(within(steps[0]!).getByText('Definir alcance')).toBeTruthy();
    expect(within(steps[1]!).getByText('Leer')).toBeTruthy();
    expect(within(steps[2]!).getByText('Entregar informe')).toBeTruthy();
    expect(screen.queryByText('Comprar cuerdas')).toBeNull();

    expect(within(steps[0]!).getByText('home.plan.origin.milestone|Preparar demo')).toBeTruthy();
    expect(within(steps[1]!).getByText('home.habit')).toBeTruthy();
    expect(within(steps[2]!).getByText('home.goal')).toBeTruthy();

    expect(screen.getByTestId('today-plan-reason-milestone:g-a:m1').props.children).toBe(
      'home.plan.reason.dueTomorrow',
    );
    expect(screen.getByTestId('today-plan-reason-goal:g-b').props.children).toBe(
      'home.plan.reason.dueSoon|3',
    );
    expect(screen.getByTestId('today-plan-reason-habit:h1').props.children).toBe(
      'home.plan.reason.habitToday',
    );
    expect(screen.queryByText('home.next')).toBeNull();
  });

  it('Enfocar fija el primer paso como objetivo y abre Pomodoro con él', async () => {
    const screen = await render(<OverviewScreen />);

    await fireEvent.press(screen.getByTestId('today-plan-focus'));

    const target = { kind: 'milestone', goalId: 'g-a', milestoneId: 'm1' };
    expect(mockPomodoro.setFocusTarget).toHaveBeenCalledWith(target);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Pomodoro', { target });
  });

  it('con una sesión corriendo no le cambia el objetivo, sólo abre Pomodoro', async () => {
    mockPomodoro.running = true;
    const screen = await render(<OverviewScreen />);

    await fireEvent.press(screen.getByTestId('today-plan-focus'));

    expect(mockPomodoro.setFocusTarget).not.toHaveBeenCalled();
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Pomodoro');
  });

  it('tocar un paso abre su edición y regresa a Inicio', async () => {
    const screen = await render(<OverviewScreen />);

    await fireEvent.press(screen.getByText('Leer'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Habits', {
      editId: 'h1',
      returnTo: 'Overview',
    });
    await fireEvent.press(screen.getByText('Definir alcance'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Goals', {
      editId: 'g-a',
      returnTo: 'Overview',
    });
  });

  it('sin plan muestra un vacío con salida concreta, no el de primera vez', async () => {
    mockState.goals = [goal({ id: 'g-done', completed: true })];
    mockState.habits = [habit({ id: 'h-done', completed: true })];
    const screen = await render(<OverviewScreen />);

    expect(screen.getByTestId('today-plan-empty')).toBeTruthy();
    expect(screen.getByText('home.plan.emptyTitle')).toBeTruthy();
    expect(screen.queryByTestId('today-plan-focus')).toBeNull();
    expect(screen.queryByText('home.emptyTitle')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'home.plan.emptyGoal' }));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Goals', { create: true });
    await fireEvent.press(screen.getByRole('button', { name: 'home.plan.emptyFocus' }));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Pomodoro');
  });

  // Va de último: el descarte del aviso vive a nivel de módulo durante la sesión.
  it('el aviso de regreso arranca el primer paso del plan', async () => {
    mockState.lastCompletedDate = dayIn(-5);
    const screen = await render(<OverviewScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'settings.resumeNudge.start' }));

    const target = { kind: 'milestone', goalId: 'g-a', milestoneId: 'm1' };
    expect(mockPomodoro.setFocusTarget).toHaveBeenCalledWith(target);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Pomodoro', { target });
  });
});
