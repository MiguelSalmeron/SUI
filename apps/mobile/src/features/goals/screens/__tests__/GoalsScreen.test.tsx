import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Goal } from '@/shared/types/models';

const mockNavigation = { setParams: jest.fn() };
let mockRouteParams: { create?: boolean; editId?: string } | undefined;
let mockFormProps: { visible: boolean; initialGoal: Goal | null } | undefined;
const mockGoals: Goal[] = Array.from({ length: 250 }, (_, index) => ({
  id: `goal-${index}`,
  title: `Meta ${index}`,
  deadline: '2030-01-01',
  progress: 0,
  milestones: [],
  impactDays: ['2030-01-01'],
  completed: false,
  gravity: 'low',
  createdAt: '2026-09-01T00:00:00.000Z',
}));
const mockState = {
  goals: mockGoals,
  addGoal: jest.fn(),
  updateGoal: jest.fn(),
  toggleGoal: jest.fn(),
  addMilestone: jest.fn(),
  toggleMilestone: jest.fn(),
  removeGoal: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('@/shared/domain/productivity/public', () => ({
  useProductivityStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, formatDate: () => '1 ene 2030' }),
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
jest.mock('@/shared/ui/PromptModal', () => ({ PromptModal: () => null }));
jest.mock('../../components/GoalFormModal', () => ({
  GoalFormModal: (props: { visible: boolean; initialGoal: Goal | null }) => {
    const React = require('react');
    const { Text } = require('react-native');
    mockFormProps = props;
    return props.visible
      ? React.createElement(Text, { testID: 'goal-form' }, props.initialGoal?.id ?? 'create')
      : null;
  },
}));

import { GoalsScreen } from '../GoalsScreen';

describe('GoalsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = undefined;
    mockFormProps = undefined;
  });

  it('virtualiza 250 metas', async () => {
    const screen = await render(<GoalsScreen />);
    const renderedRows = screen.getAllByRole('button', { name: 'goals.editLabel' });
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThan(250);
  });

  it('abre entidad correcta desde editId y limpia param', async () => {
    mockRouteParams = { editId: 'goal-42' };
    const screen = await render(<GoalsScreen />);

    await waitFor(() => expect(screen.getByTestId('goal-form').props.children).toBe('goal-42'));
    expect(mockFormProps?.initialGoal?.id).toBe('goal-42');
    expect(mockNavigation.setParams).toHaveBeenCalledWith({ editId: undefined });
  });

  it('tap área principal abre edición', async () => {
    const screen = await render(<GoalsScreen />);
    fireEvent.press(screen.getAllByRole('button', { name: 'goals.editLabel' })[0]);
    await waitFor(() => expect(screen.getByTestId('goal-form')).toBeTruthy());
    expect(mockFormProps?.initialGoal?.id).toBe('goal-0');
  });
});
