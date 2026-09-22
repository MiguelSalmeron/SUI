import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@/shared/theme/theme', () => ({
  SCREEN_MAX_CONTENT_WIDTH: 560,
  SCREEN_CONTENT_BOTTOM_PADDING: 32,
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  useAppTheme: () => ({
    colors: {
      scrim: '#0008',
      background: '#fff',
      surface: '#fff',
      surfaceContainerLow: '#eee',
      onSurface: '#000',
      onSurfaceVariant: '#333',
      onPrimary: '#fff',
      onPrimaryContainer: '#008',
      primary: '#00f',
      primaryContainer: '#ddf',
      outlineVariant: '#ccc',
      error: '#f00',
    },
    radius: { md: 8, lg: 12, xl: 24 },
    type: {
      headlineSm: {},
      titleSm: {},
      bodyLg: {},
      bodyMd: {},
      bodySm: {},
      labelLg: {},
      labelMd: {},
      labelSm: {},
    },
  }),
}));
jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import { AccountabilityCheckInSheet } from '../components/AccountabilityCheckInSheet';

const base = (overrides: Record<string, unknown> = {}) => ({
  visible: true,
  subjectTitle: 'Publicar mi portafolio',
  nextAction: 'Ordenar imágenes',
  minimumAction: 'Ordenar 5 imágenes',
  onClose: jest.fn(),
  onResolve: jest.fn(),
  ...overrides,
});

describe('AccountabilityCheckInSheet', () => {
  it('muestra las cinco decisiones cuando hay versión mínima', async () => {
    const screen = await render(<AccountabilityCheckInSheet {...base()} />);
    expect(screen.getByText('accountability.checkIn.done')).toBeTruthy();
    expect(screen.getByText('accountability.checkIn.inProgress')).toBeTruthy();
    expect(screen.getByText('accountability.checkIn.minimum')).toBeTruthy();
    expect(screen.getByText('accountability.checkIn.reschedule')).toBeTruthy();
    expect(screen.getByText('accountability.checkIn.pause')).toBeTruthy();
  });

  it('oculta la opción mínima si no hay versión mínima definida', async () => {
    const screen = await render(
    <AccountabilityCheckInSheet {...base({ minimumAction: undefined })} />,
  );
    expect(screen.queryByText('accountability.checkIn.minimum')).toBeNull();
  });

  it('resuelve completado con la nota opcional', async () => {
    const onResolve = jest.fn();
    const screen = await render(<AccountabilityCheckInSheet {...base({ onResolve })} />);
    await fireEvent.changeText(
      screen.getByPlaceholderText('accountability.checkIn.notePlaceholder'),
      'terminé antes de tiempo',
    );
    await fireEvent.press(screen.getByText('accountability.checkIn.done'));
    expect(onResolve).toHaveBeenCalledWith({ decision: 'completed' }, 'terminé antes de tiempo');
  });

  it('reprogramar exige fecha y hora válidas antes de resolver', async () => {
    const onResolve = jest.fn();
    const screen = await render(<AccountabilityCheckInSheet {...base({ onResolve })} />);
    // Primer toque: despliega el formulario de reprogramación.
    await fireEvent.press(screen.getByText('accountability.checkIn.reschedule'));
    expect(onResolve).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getAllByPlaceholderText('YYYY-MM-DD')[0], '2026-09-10');
    await fireEvent.changeText(screen.getAllByPlaceholderText('HH:MM')[0], '08:30');
    await fireEvent.press(screen.getByText('accountability.checkIn.rescheduleConfirm'));
    expect(onResolve).toHaveBeenCalledWith(
      { decision: 'reschedule', date: '2026-09-10', time: '08:30' },
      '',
    );
  });

  it('muestra el error de reprogramación con datos inválidos', async () => {
    const onResolve = jest.fn();
    const screen = await render(<AccountabilityCheckInSheet {...base({ onResolve })} />);
    await fireEvent.press(screen.getByText('accountability.checkIn.reschedule'));
    await fireEvent.press(screen.getByText('accountability.checkIn.rescheduleConfirm'));
    expect(screen.getByText('accountability.checkIn.errorReschedule')).toBeTruthy();
    expect(onResolve).not.toHaveBeenCalled();
  });

  it('cierra sin resolver al pulsar cerrar', async () => {
    const onClose = jest.fn();
    const screen = await render(<AccountabilityCheckInSheet {...base({ onClose })} />);
    await fireEvent.press(screen.getByLabelText('common.close'));
    expect(onClose).toHaveBeenCalled();
  });
});
