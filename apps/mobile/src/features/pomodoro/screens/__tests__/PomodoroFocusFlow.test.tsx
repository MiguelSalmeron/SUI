jest.mock('@/shared/infrastructure/firebase/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('@/shared/observability/telemetry', () => ({ recordTelemetry: jest.fn() }));

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

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: { target?: unknown } = {};

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockRouteParams }),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, getParent: () => null }),
  useFocusEffect: jest.fn(),
}));

import { act, fireEvent, render } from '@testing-library/react-native';
import { localDateKey, useProductivityStore } from '@/shared/domain/productivity/public';
import type { FocusTarget } from '@/shared/focus/focusTypes';
import { nextFocusTarget, sameFocusTarget } from '@/shared/focus/focusFlow';
import { resolveFocusTarget } from '@/shared/focus/completeFocusTarget';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { PomodoroScreen } from '../PomodoroScreen';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const pomodoroBase = () => ({
  minutes: 25,
  notifyOnComplete: false,
  secondsLeft: 1500,
  running: false,
  targetEndTime: null as number | null,
  dayKey: localDateKey(),
  sessions: 0,
  focusMinutes: 0,
  focusTarget: null as FocusTarget | null,
  history: [] as { dayKey: string; sessions: number; minutes: number }[],
});

const seedProductivity = () => {
  useProductivityStore.setState({
    goals: [
      {
        id: 'g1',
        title: 'Preparar proyecto',
        deadline: '2026-10-20',
        progress: 0,
        completed: false,
        gravity: 'high',
        createdAt: '2026-10-01',
        milestones: [
          { id: 'm1', title: 'Definir alcance', completed: false },
          { id: 'm2', title: 'Entregar', completed: false },
        ],
      },
    ],
    habits: [
      {
        id: 'h1',
        title: 'Leer',
        frequency: 'daily',
        completed: false,
        streak: 0,
        createdAt: '2026-10-01',
      },
    ],
  });
};

describe('Pomodoro flujo Enfocar (B2)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockRouteParams = {};
    await flush();
    usePomodoroStore.setState(pomodoroBase());
    seedProductivity();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Enfocar abre sesión con el target correcto y lo conserva al reabrir', async () => {
    // Acá se simula el Hoy → Enfocar: la ruta trae el hábito real.
    mockRouteParams = { target: { kind: 'habit', habitId: 'h1' } };
    const view = await render(<PomodoroScreen />);
    await flush();

    expect(usePomodoroStore.getState().focusTarget).toEqual({ kind: 'habit', habitId: 'h1' });
    expect(view.getByTestId('pomodoro-focus-title')).toBeTruthy();

    // Cerrar/reabrir sin parámetro no pierde el objetivo persistido.
    mockRouteParams = {};
    await view.unmount();
    const reopened = await render(<PomodoroScreen />);
    await flush();
    expect(usePomodoroStore.getState().focusTarget).toEqual({ kind: 'habit', habitId: 'h1' });
    expect(reopened.getByTestId('pomodoro-focus-title')).toBeTruthy();
    await reopened.unmount();
  });

  it('completar sesión actualiza historial sin tocar persistencia crítica', async () => {
    mockRouteParams = { target: { kind: 'habit', habitId: 'h1' } };
    const view = await render(<PomodoroScreen />);
    await flush();

    await act(async () => {
      usePomodoroStore.getState().start();
    });
    await act(async () => {
      usePomodoroStore.getState().completeSession();
    });

    const state = usePomodoroStore.getState();
    expect(state.sessions).toBe(1);
    expect(state.focusMinutes).toBe(25);
    expect(state.history).toEqual([{ dayKey: localDateKey(), sessions: 1, minutes: 25 }]);
    // El panel de cierre aparece para avanzar al paso.
    expect(view.getByTestId('pomodoro-complete-panel')).toBeTruthy();
    await view.unmount();
  });

  it('completar target no duplica estado ante doble toque', async () => {
    mockRouteParams = { target: { kind: 'habit', habitId: 'h1' } };
    const view = await render(<PomodoroScreen />);
    await flush();

    // Sesión terminada: el motor ya registró completeSession una sola vez.
    await act(async () => {
      usePomodoroStore.getState().start();
    });
    await act(async () => {
      usePomodoroStore.getState().completeSession();
    });
    await act(async () => {
      usePomodoroStore.getState().completeSession();
    });
    expect(usePomodoroStore.getState().sessions).toBe(1);

    const button = view.getByTestId('pomodoro-complete-target');
    await fireEvent.press(button);
    await fireEvent.press(button);

    const habit = useProductivityStore.getState().habits.find((item) => item.id === 'h1');
    expect(habit).toMatchObject({ completed: true, streak: 1 });
    expect(view.getByTestId('pomodoro-focus-done')).toBeTruthy();
    await view.unmount();
  });

  it('tras completar, el siguiente paso lógico avanza y puede volver a Hoy', async () => {
    // Dos pasos pendientes: hábito y primer hito; se enfoca el primero.
    const steps = [
      { target: { kind: 'habit', habitId: 'h1' } as FocusTarget },
      { target: { kind: 'milestone', goalId: 'g1', milestoneId: 'm1' } as FocusTarget },
    ];
    const current = nextFocusTarget(steps, null);
    expect(current).toEqual(steps[0]!.target);
    expect(resolveFocusTarget(current!).status).toBe('pending');

    mockRouteParams = { target: current };
    const view = await render(<PomodoroScreen />);
    await flush();
    await act(async () => {
      usePomodoroStore.getState().start();
    });
    await act(async () => {
      usePomodoroStore.getState().completeSession();
    });
    await fireEvent.press(view.getByTestId('pomodoro-complete-target'));

    // El paso hecho queda listo y el siguiente ya no es el mismo.
    expect(resolveFocusTarget(current!).status).toBe('done');
    const next = nextFocusTarget(steps, current);
    expect(next).toEqual(steps[1]!.target);
    expect(sameFocusTarget(next, current)).toBe(false);

    await fireEvent.press(view.getByTestId('pomodoro-back-today'));
    expect(mockNavigate).toHaveBeenCalledWith('Home');
    await view.unmount();
  });

  it('sin target la sesión sigue segura como libre', async () => {
    useProductivityStore.setState({ goals: [], habits: [] });
    mockRouteParams = {};
    const view = await render(<PomodoroScreen />);
    await flush();

    expect(view.getByText('pomodoro.freeSession')).toBeTruthy();
    expect(view.queryByTestId('pomodoro-complete-target')).toBeNull();
    await fireEvent.press(view.getByTestId('pomodoro-start'));
    expect(usePomodoroStore.getState().running).toBe(true);
    await view.unmount();
  });
});
