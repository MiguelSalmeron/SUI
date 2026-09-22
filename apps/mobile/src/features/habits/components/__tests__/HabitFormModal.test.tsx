import { render } from '@testing-library/react-native';

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
    },
    radius: { md: 8, lg: 12, xl: 24 },
    type: {
      headlineSm: {},
      bodyLg: {},
      bodyMd: {},
      bodySm: {},
      labelLg: {},
      labelMd: {},
      labelSm: {},
      titleSm: {},
    },
  }),
}));
jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import { buildHabitDraft, HabitFormModal, isValidHabitTime } from '../HabitFormModal';

describe('isValidHabitTime', () => {
  it('acepta HH:MM 24h y rechaza variantes', () => {
    expect(isValidHabitTime('07:30')).toBe(true);
    expect(isValidHabitTime('23:59')).toBe(true);
    expect(isValidHabitTime('7:30')).toBe(false);
    expect(isValidHabitTime('24:00')).toBe(false);
    expect(isValidHabitTime('')).toBe(false);
  });
});

describe('buildHabitDraft', () => {
  const base = {
    title: 'Gym',
    daily: true,
    days: [] as never[],
    linkedGoalId: null,
    plannedTime: '',
    mirrorToGoogle: false,
  };

  it('draft sin espejo por defecto', () => {
    expect(buildHabitDraft({ ...base, title: 'Leer' })).toEqual({
      draft: expect.objectContaining({ title: 'Leer', mirrorToGoogle: false }),
    });
  });

  it('rechaza título vacío y días vacíos', () => {
    expect(buildHabitDraft({ ...base, title: '  ' })).toEqual({
      errorKey: 'habitForm.required',
    });
    expect(buildHabitDraft({ ...base, daily: false, days: [] })).toEqual({
      errorKey: 'habitForm.dayRequired',
    });
  });

  it('espejo exige hora válida', () => {
    expect(buildHabitDraft({ ...base, mirrorToGoogle: true, plannedTime: '' })).toEqual({
      errorKey: 'habitForm.invalidTime',
    });
    expect(buildHabitDraft({ ...base, mirrorToGoogle: true, plannedTime: '7:30' })).toEqual({
      errorKey: 'habitForm.invalidTime',
    });
    expect(
      buildHabitDraft({ ...base, mirrorToGoogle: true, plannedTime: '07:30' }),
    ).toEqual({
      draft: expect.objectContaining({ plannedTime: '07:30', mirrorToGoogle: true }),
    });
  });

  it('conserva hora aunque el espejo esté apagado, sin plannedTime si es inválida', () => {
    expect(buildHabitDraft({ ...base, plannedTime: '07:30' })).toEqual({
      draft: expect.objectContaining({ plannedTime: '07:30', mirrorToGoogle: false }),
    });
    const result = buildHabitDraft({ ...base, plannedTime: '7:30' });
    expect(result).toEqual({ draft: expect.objectContaining({ mirrorToGoogle: false }) });
    if ('draft' in result) expect(result.draft).not.toHaveProperty('plannedTime');
  });
});

describe('HabitFormModal render', () => {
  it('muestra hora y toggle de espejo, precarga hábito con espejo', async () => {
    const screen = await render(
      <HabitFormModal
        visible
        goals={[]}
        initialHabit={{
          id: 'habit-1',
          title: 'Gym',
          completed: false,
          frequency: 'daily',
          streak: 0,
          createdAt: '2026-09-01',
          plannedTime: '07:30',
          mirrorToGoogle: true,
        }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId('habit-time-input').props.value).toBe('07:30');
    expect(screen.getByTestId('habit-mirror-toggle').props.accessibilityState).toEqual({
      checked: true,
    });
  });
});
