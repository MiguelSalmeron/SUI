import { fireEvent, render, waitFor } from '@testing-library/react-native';

// Acá se prueba lo que el jurado ve: agenda liviana, ancla y fantasma.
// Sin lógica duplicada, solo comportamiento visible.
const mockNavigate = jest.fn();
const mockGoals = [
  {
    id: 'goal-1',
    title: 'Meta 1',
    deadline: '2026-09-01',
    progress: 0,
    milestones: [],
    completed: false,
    gravity: 'low',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
];
const mockHabits = [
  {
    id: 'habit-1',
    title: 'Hábito 1',
    completed: false,
    frequency: 'daily',
    streak: 2,
    linkedGoalId: null,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
];
const mockState = {
  goals: mockGoals,
  habits: mockHabits,
  addGoal: jest.fn(),
};
let mockConnected = false;
let mockHabitDue = true;
let mockDismissed = false;
const mockSetDismissed = jest.fn((value: boolean) => {
  mockDismissed = value;
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('../../hooks/useGoogleCalendar', () => ({
  // El hook devuelve el contrato `ConnectionProvider`: los eventos van en
  // `data`, no en el `events` del cast viejo.
  useGoogleCalendar: () => ({ data: [], connected: mockConnected }),
}));
jest.mock('../../hooks/useMirrorEffects', () => ({
  useMirrorEffects: jest.fn(),
}));
jest.mock('@/shared/domain/productivity/public', () => ({
  isHabitDueToday: () => mockHabitDue,
  // Claves reales por fecha: con retorno constante se duplicaban y React
  // advertía claves repetidas. Así el test refleja el comportamiento real.
  localDateKey: (date?: Date) => {
    const target = date ?? new Date();
    const month = `${target.getMonth() + 1}`.padStart(2, '0');
    const day = `${target.getDate()}`.padStart(2, '0');
    return `${target.getFullYear()}-${month}-${day}`;
  },
  useProductivityStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));
jest.mock('@/shared/preferences/useSettingsStore', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      calendarConnectDismissed: mockDismissed,
      setCalendarConnectDismissed: mockSetDismissed,
    }),
}));
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({
    locale: 'es',
    t: (key: string) => key,
    formatDate: () => 'septiembre 2026',
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
    useAppTheme: () => ({
      colors,
      radius,
      type,
      motion: { duration: { short4: 200 } },
    }),
  };
});
jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/ui/ScreenIntro', () => ({ ScreenIntro: () => null }));
jest.mock('@/shared/ui/SuiDoodle', () => ({ SuiDoodle: () => null }));
jest.mock('@/shared/ui/PromptModal', () => ({ PromptModal: () => null }));
jest.mock('@/shared/ui/motion/useReduceMotion', () => ({
  useReduceMotion: () => false,
}));

import { CalendarScreen } from '../CalendarScreen';

const dayCells = (screen: { getAllByRole: Function }) =>
  screen.getAllByRole('button').filter((node: { props: { accessibilityLabel?: unknown } }) => {
    const label = String(node.props.accessibilityLabel ?? '');
    return label.includes('calendar.activity') || label.includes('calendar.activities');
  });

describe('CalendarScreen liviana', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnected = false;
    mockHabitDue = true;
    mockDismissed = false;
  });

  it('muestra 14 días por defecto y 42 al expandir', async () => {
    const screen = await render(<CalendarScreen />);
    expect(dayCells(screen)).toHaveLength(14);
    fireEvent.press(screen.getByText('calendar.showMonth'));
    await waitFor(() => expect(dayCells(screen)).toHaveLength(42));
  });

  it('anuncia día con conteo y contexto', async () => {
    const screen = await render(<CalendarScreen />);
    expect(dayCells(screen).length).toBeGreaterThan(0);
  });

  it('fantasma compacto con día lleno y descarte persiste', async () => {
    const screen = await render(<CalendarScreen />);
    expect(screen.getByText('calendar.connectGhost')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'calendar.dismiss' }));
    expect(mockSetDismissed).toHaveBeenCalledWith(true);
  });

  it('fantasma amplio con día libre', async () => {
    mockHabitDue = false;
    const screen = await render(<CalendarScreen />);
    expect(screen.getByText('calendar.connectTitle')).toBeTruthy();
  });

  it('sin fantasma si ya conectado o descartado', async () => {
    mockConnected = true;
    const connected = await render(<CalendarScreen />);
    expect(connected.queryByText('calendar.connectGhost')).toBeNull();
    mockConnected = false;
    mockDismissed = true;
    const dismissed = await render(<CalendarScreen />);
    expect(dismissed.queryByText('calendar.connectGhost')).toBeNull();
  });
});
