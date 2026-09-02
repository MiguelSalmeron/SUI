import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Habit } from '@/shared/types/models';

const mockNavigation = { setParams: jest.fn() };
let mockRouteParams: { create?: boolean; editId?: string } | undefined;
let mockFormProps: { visible: boolean; initialHabit: Habit | null } | undefined;
const mockHabits: Habit[] = Array.from({ length: 250 }, (_, index) => ({
  id: `habit-${index}`,
  title: `Hábito ${index}`,
  completed: false,
  frequency: 'daily',
  streak: 0,
  linkedGoalId: null,
  createdAt: '2026-09-01T00:00:00.000Z',
}));
const mockState = {
  habits: mockHabits,
  goals: [],
  addHabit: jest.fn(),
  updateHabit: jest.fn(),
  toggleHabit: jest.fn(),
  freezeStreak: jest.fn(),
  removeHabit: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('@/shared/domain/productivity/public', () => ({
  isHabitDueToday: () => true,
  localDateKey: () => '2026-09-01',
  useProductivityStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
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
jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/ui/ScreenIntro', () => ({ ScreenIntro: () => null }));
jest.mock('@/shared/ui/SuiDoodle', () => ({ SuiDoodle: () => null }));
jest.mock('../../components/HabitFormModal', () => ({
  HabitFormModal: (props: { visible: boolean; initialHabit: Habit | null }) => {
    const React = require('react');
    const { Text } = require('react-native');
    mockFormProps = props;
    return props.visible
      ? React.createElement(Text, { testID: 'habit-form' }, props.initialHabit?.id ?? 'create')
      : null;
  },
}));

import { HabitsScreen } from '../HabitsScreen';

describe('HabitsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = undefined;
    mockFormProps = undefined;
  });

  it('virtualiza 250 hábitos', async () => {
    const screen = await render(<HabitsScreen />);
    const renderedRows = screen.getAllByRole('button', { name: 'habits.editLabel' });
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThan(250);
  });

  it('abre entidad correcta desde editId y limpia param', async () => {
    mockRouteParams = { editId: 'habit-42' };
    const screen = await render(<HabitsScreen />);

    await waitFor(() => expect(screen.getByTestId('habit-form').props.children).toBe('habit-42'));
    expect(mockFormProps?.initialHabit?.id).toBe('habit-42');
    expect(mockNavigation.setParams).toHaveBeenCalledWith({ editId: undefined });
  });

  it('checkbox conserva acción sin abrir edición', async () => {
    const screen = await render(<HabitsScreen />);
    fireEvent.press(screen.getByRole('checkbox', { name: 'Hábito 0' }));
    expect(mockState.toggleHabit).toHaveBeenCalledWith('habit-0');
    expect(screen.queryByTestId('habit-form')).toBeNull();
  });

  it('tap área principal abre edición', async () => {
    const screen = await render(<HabitsScreen />);
    fireEvent.press(screen.getAllByRole('button', { name: 'habits.editLabel' })[0]);
    await waitFor(() => expect(screen.getByTestId('habit-form')).toBeTruthy());
    expect(mockFormProps?.initialHabit?.id).toBe('habit-0');
  });
});
