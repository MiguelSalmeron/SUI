import { act, fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';

jest.mock('@expo/ui/community/datetime-picker', () => ({
  DateTimePicker: (props: object) =>
    require('react').createElement(require('react-native').View, props),
}));
jest.mock('@/shared/theme/theme', () => ({
  SCREEN_MAX_CONTENT_WIDTH: 560,
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  useAppTheme: () => ({
    colors: {
      scrim: '#0008',
      surface: '#fff',
      onSurface: '#000',
      onSurfaceVariant: '#333',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#ddf',
      onPrimaryContainer: '#008',
      surfaceContainerLow: '#eee',
      outlineVariant: '#ccc',
      error: '#f00',
      flame: '#f60',
      flameContainer: '#fed',
      onFlameContainer: '#900',
    },
    radius: { md: 8, lg: 12, xl: 24 },
    type: {
      headlineSm: {},
      bodyLg: {},
      bodyMd: {},
      bodySm: {},
      labelLg: {},
      labelMd: {},
      titleSm: {},
    },
  }),
}));
jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, formatDate: () => '20 sep' }),
}));
jest.mock('@/shared/domain/productivity/public', () => ({
  localDateKey: (value: unknown) =>
    value instanceof Date
      ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
      : '2026-09-08',
}));

import { buildGoalDraft, GoalFormModal } from '../GoalFormModal';

describe('buildGoalDraft', () => {
  const base = {
    title: 'Entregar MVP',
    deadline: '2026-09-20',
    gravity: 'low' as const,
    mirrorToGoogle: true,
    today: '2026-09-08',
    enforceNotPast: true,
  };

  it('draft válido con espejo por defecto', () => {
    expect(buildGoalDraft(base)).toEqual({
      draft: expect.objectContaining({
        title: 'Entregar MVP',
        deadline: '2026-09-20',
        mirrorToGoogle: true,
      }),
    });
  });

  it('rechaza título vacío, fecha inválida y pasada', () => {
    expect(buildGoalDraft({ ...base, title: '  ' })).toEqual({
      errorKey: 'goalForm.required',
    });
    expect(buildGoalDraft({ ...base, deadline: '2026-13-40' })).toEqual({
      errorKey: 'goalForm.invalidDate',
    });
    expect(buildGoalDraft({ ...base, deadline: '2026-09-01' })).toEqual({
      errorKey: 'goalForm.pastDate',
    });
  });

  it('permite pasada al editar sin tocar fecha y respeta opt-out', () => {
    expect(buildGoalDraft({ ...base, deadline: '2026-09-01', enforceNotPast: false })).toEqual({
      draft: expect.objectContaining({ deadline: '2026-09-01' }),
    });
    expect(buildGoalDraft({ ...base, mirrorToGoogle: false })).toEqual({
      draft: expect.objectContaining({ mirrorToGoogle: false }),
    });
  });
});

describe('GoalFormModal render', () => {
  it('muestra toggle de espejo, precarga opt-out al editar', async () => {
    const screen = await render(
      <GoalFormModal
        visible
        initialGoal={{
          id: 'goal-1',
          title: 'Meta',
          deadline: '2026-09-20',
          progress: 0,
          milestones: [],
          completed: false,
          gravity: 'low',
          createdAt: '2026-09-01',
          mirrorToGoogle: false,
        }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId('goal-mirror-toggle').props.accessibilityState).toEqual({
      checked: false,
    });
  });

  it('abre selector Android bajo demanda y lo desmonta al aceptar o cancelar', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    try {
      const screen = await render(
        <GoalFormModal visible onSubmit={() => {}} onCancel={() => {}} />,
      );

      expect(screen.queryByTestId('goal-date-picker')).toBeNull();

      await act(async () => {
        fireEvent.press(screen.getByTestId('goal-date-picker-trigger'));
      });
      await act(async () => {
        screen.getByTestId('goal-date-picker').props.onValueChange({}, new Date(2026, 8, 20, 12));
      });
      expect(screen.queryByTestId('goal-date-picker')).toBeNull();

      await act(async () => {
        fireEvent.press(screen.getByTestId('goal-date-picker-trigger'));
      });
      await act(async () => {
        screen.getByTestId('goal-date-picker').props.onDismiss();
      });
      expect(screen.queryByTestId('goal-date-picker')).toBeNull();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    }
  });
});
