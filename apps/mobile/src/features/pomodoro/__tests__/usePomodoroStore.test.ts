// `productivity/public` arrastra firebase (ESM) fuera del alcance de jest;
// se reemplaza por sus submódulos ligeros reales.
jest.mock('@/shared/domain/productivity/public', () => ({
  ...jest.requireActual('@/shared/domain/productivity/model/homeStorage'),
  ...jest.requireActual('@/shared/domain/productivity/store/useCelebrationStore'),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from '@/shared/domain/productivity/public';
import {
  DEFAULT_POMODORO_MINUTES,
  POMODORO_MAX_MINUTES,
  POMODORO_MIN_MINUTES,
  POMODORO_STORAGE_KEY,
  usePomodoroStore,
} from '../store/usePomodoroStore';

const baseline = () => ({
  minutes: DEFAULT_POMODORO_MINUTES,
  notifyOnComplete: false,
  secondsLeft: DEFAULT_POMODORO_MINUTES * 60,
  running: false,
  targetEndTime: null,
  dayKey: localDateKey(),
  sessions: 0,
  focusMinutes: 0,
});

describe('usePomodoroStore', () => {
  beforeEach(() => {
    usePomodoroStore.setState(baseline());
    (AsyncStorage as { __reset?: () => void }).__reset?.();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('arranca con 25 minutos por defecto', () => {
    const state = usePomodoroStore.getState();
    expect(state.minutes).toBe(25);
    expect(state.secondsLeft).toBe(1500);
    expect(state.running).toBe(false);
    expect(state.sessions).toBe(0);
  });

  it('ajusta duración dentro del rango y reinicia la cuenta en reposo', () => {
    usePomodoroStore.getState().setMinutes(50);
    expect(usePomodoroStore.getState().minutes).toBe(50);
    expect(usePomodoroStore.getState().secondsLeft).toBe(3000);

    usePomodoroStore.getState().setMinutes(999);
    expect(usePomodoroStore.getState().minutes).toBe(POMODORO_MAX_MINUTES);

    usePomodoroStore.getState().setMinutes(0);
    expect(usePomodoroStore.getState().minutes).toBe(POMODORO_MIN_MINUTES);
  });

  it('start inicia la cuenta regresiva y es idempotente', () => {
    const now = Date.now();
    usePomodoroStore.getState().start();

    const state = usePomodoroStore.getState();
    expect(state.running).toBe(true);
    expect(state.targetEndTime).toBeGreaterThanOrEqual(now + 1500_000 - 1000);
    expect(state.secondsLeft).toBe(1500);

    const target = state.targetEndTime;
    usePomodoroStore.getState().start();
    expect(usePomodoroStore.getState().targetEndTime).toBe(target);
  });

  it('pause conserva el progreso y resume arranca desde donde quedó', () => {
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().syncRemaining(900);
    usePomodoroStore.getState().pause();

    let state = usePomodoroStore.getState();
    expect(state.running).toBe(false);
    expect(state.targetEndTime).toBeNull();
    expect(state.secondsLeft).toBe(900);

    const now = Date.now();
    usePomodoroStore.getState().resume();
    state = usePomodoroStore.getState();
    expect(state.running).toBe(true);
    expect(state.targetEndTime).toBeGreaterThanOrEqual(now + 900_000 - 1000);
    expect(state.secondsLeft).toBe(900);
  });

  it('reset vuelve al estado inicial completo', () => {
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().syncRemaining(60);
    usePomodoroStore.getState().reset();

    const state = usePomodoroStore.getState();
    expect(state.running).toBe(false);
    expect(state.targetEndTime).toBeNull();
    expect(state.secondsLeft).toBe(1500);
  });

  it('completa una sola vez por sesión y acumula estadísticas del día', () => {
    usePomodoroStore.getState().completeSession();
    // Sin sesión activa no cuenta.
    expect(usePomodoroStore.getState().sessions).toBe(0);

    usePomodoroStore.getState().start();
    usePomodoroStore.getState().completeSession();
    usePomodoroStore.getState().completeSession();

    const state = usePomodoroStore.getState();
    expect(state.running).toBe(false);
    expect(state.secondsLeft).toBe(0);
    expect(state.sessions).toBe(1);
    expect(state.focusMinutes).toBe(25);
  });

  it('reinicia las estadísticas al cambiar de día', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T10:00:00.000Z'));

    usePomodoroStore.getState().start();
    usePomodoroStore.getState().completeSession();
    expect(usePomodoroStore.getState().dayKey).toBe('2026-09-05');
    expect(usePomodoroStore.getState().sessions).toBe(1);

    jest.setSystemTime(new Date('2026-09-06T10:00:00.000Z'));
    usePomodoroStore.getState().refreshDay();
    let state = usePomodoroStore.getState();
    expect(state.dayKey).toBe('2026-09-06');
    expect(state.sessions).toBe(0);
    expect(state.focusMinutes).toBe(0);

    // Un completado del nuevo día también normaliza solo.
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().completeSession();
    state = usePomodoroStore.getState();
    expect(state.dayKey).toBe('2026-09-06');
    expect(state.sessions).toBe(1);
  });

  it('persiste preferencias y estado de sesión (sin segundos en memoria)', async () => {
    usePomodoroStore.getState().setMinutes(40);
    usePomodoroStore.getState().setNotifyOnComplete(true);
    usePomodoroStore.getState().start();

    await new Promise((resolve) => setTimeout(resolve, 0));
    const raw = (await AsyncStorage.getItem(POMODORO_STORAGE_KEY)) ?? '{}';
    // persist envuelve con { state, version } vía createJSONStorage.
    const payload = JSON.parse(raw) as { state: Record<string, unknown>; version: number };

    expect(payload.state.minutes).toBe(40);
    expect(payload.state.notifyOnComplete).toBe(true);
    expect(payload.state.running).toBe(true);
    expect(typeof payload.state.targetEndTime).toBe('number');
    // secondsLeft es sólo memoria y nunca se persiste.
    expect(payload.state.secondsLeft).toBeUndefined();
  });
});
