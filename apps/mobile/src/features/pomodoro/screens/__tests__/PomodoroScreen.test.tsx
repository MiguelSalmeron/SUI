// `productivity/public` arrastra firebase (ESM) fuera del alcance de jest.
jest.mock('@/shared/domain/productivity/public', () => ({
  ...jest.requireActual('@/shared/domain/productivity/model/homeStorage'),
  ...jest.requireActual('@/shared/domain/productivity/store/useCelebrationStore'),
}));

jest.mock('@/shared/observability/telemetry', () => ({
  recordTelemetry: jest.fn(),
}));

jest.mock('@/features/pomodoro/services/notifications', () => ({
  schedulePomodoroCompleteNotification: jest.fn(async () => undefined),
  cancelPomodoroCompleteNotification: jest.fn(async () => undefined),
}));

jest.mock('@/shared/infrastructure/notifications', () => ({
  getNotificationPermission: jest.fn(async () => 'granted'),
  requestNotificationPermission: jest.fn(async () => 'granted'),
  cancelScheduledNotification: jest.fn(async () => undefined),
  scheduleLocalNotification: jest.fn(async () => undefined),
}));

jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/shared/theme/theme', () => {
  const colors = new Proxy({}, { get: () => '#000000' });
  const radius = new Proxy({}, { get: () => 12 });
  const type = new Proxy({}, { get: () => ({}) });
  const surface = {
    backgroundColor: '#ffffff',
    borderColor: '#000000',
    borderWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  };
  return {
    SCREEN_CONTENT_BOTTOM_PADDING: 80,
    SCREEN_MAX_CONTENT_WIDTH: 560,
    SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    MD3_RADIUS: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 999 },
    createSurface: () => surface,
    useAppTheme: () => ({
      colors,
      radius,
      type,
      stateLayer: { hover: 0.08, pressed: 0.12, dragged: 0.16, focus: 0.12 },
    }),
  };
});

jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));

import { fireEvent, render } from '@testing-library/react-native';
import { localDateKey } from '@/shared/domain/productivity/public';
import {
  getNotificationPermission,
  requestNotificationPermission,
} from '@/shared/infrastructure/notifications';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { PomodoroScreen } from '../PomodoroScreen';

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

describe('PomodoroScreen', () => {
  beforeAll(() => {
    jest.setTimeout(15000);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await flush();
    usePomodoroStore.setState(baseState());
    jest.mocked(requestNotificationPermission).mockResolvedValue('granted');
    jest.mocked(getNotificationPermission).mockResolvedValue('granted');
  });

  afterEach(() => {
    // Aunque un test falle a mitad de camino, nunca dejar fake timers activos
    // que congelen el `setTimeout` del beforeEach del siguiente test.
    jest.useRealTimers();
  });

  it('en reposo muestra la duración y el botón Comenzar', async () => {
    const view = await render(<PomodoroScreen />);

    expect(view.getByText('25:00')).toBeTruthy();
    expect(view.getByTestId('pomodoro-start')).toBeTruthy();
    expect(view.queryByTestId('pomodoro-resume')).toBeNull();
    await view.unmount();
  });

  it('en pausa muestra Reanudar con el progreso retenido', async () => {
    usePomodoroStore.setState({ running: false, secondsLeft: 1440 });
    const view = await render(<PomodoroScreen />);

    expect(view.getByText('24:00')).toBeTruthy();
    expect(view.getByTestId('pomodoro-resume')).toBeTruthy();
    expect(view.getByText('pomodoro.paused')).toBeTruthy();
    await view.unmount();
  });

  it('en sesión activa muestra Pausar y bloquea opciones', async () => {
    usePomodoroStore.setState({
      running: true,
      targetEndTime: Date.now() + 600_000,
      secondsLeft: 600,
    });
    const view = await render(<PomodoroScreen />);

    expect(view.getByText('10:00')).toBeTruthy();
    expect(view.getByTestId('pomodoro-pause')).toBeTruthy();
    expect(view.getByText('pomodoro.lockedDuringSession')).toBeTruthy();
    await view.unmount();
  });

  it('Comenzar desde reposo inicia la sesión', async () => {
    const view = await render(<PomodoroScreen />);

    await fireEvent.press(view.getByTestId('pomodoro-start'));
    expect(usePomodoroStore.getState().running).toBe(true);
    expect(usePomodoroStore.getState().targetEndTime).not.toBeNull();
    await view.unmount();
  });

  it('Reanudar desde pausa retoma con el progreso', async () => {
    usePomodoroStore.setState({ running: false, secondsLeft: 1440, targetEndTime: null });
    const view = await render(<PomodoroScreen />);

    await fireEvent.press(view.getByTestId('pomodoro-resume'));
    expect(usePomodoroStore.getState().running).toBe(true);
    expect(usePomodoroStore.getState().targetEndTime).toBeGreaterThan(Date.now() + 1400_000);
    await view.unmount();
  });

  it('Pausar desde sesión activa detiene conservando progreso', async () => {
    usePomodoroStore.setState({
      running: true,
      secondsLeft: 1440,
      targetEndTime: Date.now() + 1440_000,
    });
    const view = await render(<PomodoroScreen />);

    await fireEvent.press(view.getByTestId('pomodoro-pause'));
    expect(usePomodoroStore.getState().running).toBe(false);
    expect(usePomodoroStore.getState().secondsLeft).toBe(1440);
    expect(usePomodoroStore.getState().targetEndTime).toBeNull();
    await view.unmount();
  });

  it('Reiniciar restaura la duración completa', async () => {
    usePomodoroStore.setState({
      running: true,
      secondsLeft: 1440,
      targetEndTime: Date.now() + 1440_000,
    });
    const view = await render(<PomodoroScreen />);

    await fireEvent.press(view.getByTestId('pomodoro-reset'));
    expect(usePomodoroStore.getState().running).toBe(false);
    expect(usePomodoroStore.getState().secondsLeft).toBe(1500);
    await view.unmount();
  });

  it('configura la duración validando el rango', async () => {
    const view = await render(<PomodoroScreen />);

    await fireEvent.press(view.getByTestId('pomodoro-config-row'));
    expect(view.getByTestId('pomodoro-config-modal')).toBeTruthy();

    // Valor inválido: muestra error y permanece abierto.
    await fireEvent.changeText(view.getByLabelText('pomodoro.configTitle'), '0');
    await fireEvent.press(view.getByLabelText('pomodoro.configApply'));
    expect(view.getByText('pomodoro.configError')).toBeTruthy();
    expect(view.getByTestId('pomodoro-config-modal')).toBeTruthy();

    // Valor válido: aplica y cierra.
    await fireEvent.changeText(view.getByLabelText('pomodoro.configTitle'), '45');
    await fireEvent.press(view.getByLabelText('pomodoro.configApply'));
    expect(usePomodoroStore.getState().minutes).toBe(45);
    expect(view.getByText('45:00')).toBeTruthy();
    expect(view.queryByTestId('pomodoro-config-modal')).toBeNull();
    await view.unmount();
  });

  it('activa el aviso de fin tras conceder permiso y permite desactivarlo', async () => {
    const view = await render(<PomodoroScreen />);

    await fireEvent.press(view.getByTestId('pomodoro-notify-row'));
    expect(view.getByText('pomodoro.notifyConfirmTitle')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('pomodoro.notifyConfirmAction'));
    expect(usePomodoroStore.getState().notifyOnComplete).toBe(true);
    expect(view.getByText('pomodoro.notifyOn')).toBeTruthy();

    // Un segundo toque desactiva directamente.
    await fireEvent.press(view.getByTestId('pomodoro-notify-row'));
    expect(usePomodoroStore.getState().notifyOnComplete).toBe(false);
    expect(view.getByText('pomodoro.notifyHint')).toBeTruthy();
    await view.unmount();
  });

  it('mantiene el aviso apagado y muestra error si el permiso se niega', async () => {
    jest.mocked(requestNotificationPermission).mockResolvedValue('denied');
    const view = await render(<PomodoroScreen />);

    await fireEvent.press(view.getByTestId('pomodoro-notify-row'));
    await fireEvent.press(view.getByLabelText('pomodoro.notifyConfirmAction'));

    expect(usePomodoroStore.getState().notifyOnComplete).toBe(false);
    expect(view.getByText('pomodoro.notifyDenied')).toBeTruthy();
    expect(view.getByText('pomodoro.notifyConfirmTitle')).toBeTruthy();
    await view.unmount();
  });
});
