// `productivity/public` arrastra firebase (ESM) fuera del alcance de jest;
// se reemplaza por sus submódulos ligeros reales.
jest.mock('@/shared/domain/productivity/public', () => ({
  ...jest.requireActual('@/shared/domain/productivity/model/homeStorage'),
  ...jest.requireActual('@/shared/domain/productivity/store/useCelebrationStore'),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook } from '@testing-library/react-native';
import { localDateKey } from '@/shared/domain/productivity/public';
import type { FocusTarget } from '@/shared/focus/focusTypes';
import {
  DEFAULT_POMODORO_MINUTES,
  POMODORO_MAX_MINUTES,
  POMODORO_MIN_MINUTES,
  POMODORO_STORAGE_KEY,
  useFocusHistory,
  usePomodoroStore,
} from '../store/usePomodoroStore';

const baseline = () => ({
  minutes: DEFAULT_POMODORO_MINUTES,
  notifyOnComplete: false,
  secondsLeft: DEFAULT_POMODORO_MINUTES * 60,
  running: false,
  targetEndTime: null as number | null,
  dayKey: localDateKey(),
  sessions: 0,
  focusMinutes: 0,
  focusTarget: null as FocusTarget | null,
  history: [] as { dayKey: string; sessions: number; minutes: number }[],
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

  it('fija y limpia el objetivo sin tocar la sesión', () => {
    // Acá se verifica que cambiar el objetivo no arranque ni detenga nada:
    // B2 lo fija desde la navegación con la sesión en reposo.
    const target: FocusTarget = { kind: 'milestone', goalId: 'g1', milestoneId: 'm1' };
    usePomodoroStore.getState().setFocusTarget(target);
    expect(usePomodoroStore.getState().focusTarget).toEqual(target);
    expect(usePomodoroStore.getState().running).toBe(false);

    usePomodoroStore.getState().setFocusTarget(null);
    expect(usePomodoroStore.getState().focusTarget).toBeNull();

    usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h1' });
    usePomodoroStore.getState().setFocusTarget(null);
    expect(usePomodoroStore.getState().focusTarget).toBeNull();
  });

  it('completeSession acumula el día de hoy en el historial', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T10:00:00.000Z'));

    usePomodoroStore.getState().start();
    usePomodoroStore.getState().completeSession();

    let state = usePomodoroStore.getState();
    expect(state.history).toEqual([{ dayKey: '2026-09-05', sessions: 1, minutes: 25 }]);

    usePomodoroStore.getState().start();
    usePomodoroStore.getState().completeSession();

    state = usePomodoroStore.getState();
    expect(state.history).toEqual([{ dayKey: '2026-09-05', sessions: 2, minutes: 50 }]);
    expect(state.sessions).toBe(2);
    expect(state.focusMinutes).toBe(50);
  });

  it('refreshDay reinicia contadores pero conserva historial y objetivo', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T10:00:00.000Z'));

    usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h1' });
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().completeSession();
    expect(usePomodoroStore.getState().history).toHaveLength(1);

    jest.setSystemTime(new Date('2026-09-06T10:00:00.000Z'));
    usePomodoroStore.getState().refreshDay();

    const state = usePomodoroStore.getState();
    expect(state.dayKey).toBe('2026-09-06');
    expect(state.sessions).toBe(0);
    expect(state.focusMinutes).toBe(0);
    // El historial no se borra con el cambio de día: Semana lo lee después.
    expect(state.history).toEqual([{ dayKey: '2026-09-05', sessions: 1, minutes: 25 }]);
    expect(state.focusTarget).toEqual({ kind: 'habit', habitId: 'h1' });
  });

  it('el historial no pasa del tope de 14 días', () => {
    jest.useFakeTimers();
    // Se siembran 14 días viejos y se completa hoy: dale, el más viejo sale.
    const seed = Array.from({ length: 14 }, (_, index) => ({
      dayKey: `2026-08-${String(index + 10).padStart(2, '0')}`,
      sessions: 1,
      minutes: 25,
    }));
    jest.setSystemTime(new Date('2026-09-05T10:00:00.000Z'));
    usePomodoroStore.setState({ ...baseline(), history: seed });

    usePomodoroStore.getState().start();
    usePomodoroStore.getState().completeSession();

    const state = usePomodoroStore.getState();
    expect(state.history).toHaveLength(14);
    expect(state.history.at(-1)).toEqual({ dayKey: '2026-09-05', sessions: 1, minutes: 25 });
    expect(state.history[0]!.dayKey).not.toBe('2026-08-10');
  });

  it('hidrata un payload viejo sin los campos nuevos y conserva la sesión activa', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T10:00:00.000Z'));
    // Payload de la versión anterior: sin focusTarget ni history.
    const persisted = {
      minutes: 25,
      notifyOnComplete: false,
      dayKey: '2026-09-05',
      sessions: 0,
      focusMinutes: 0,
      running: true,
      targetEndTime: Date.now() + 60_000,
    };
    const current = {
      ...usePomodoroStore.getState(),
      ...baseline(),
      running: false,
      targetEndTime: null as number | null,
      secondsLeft: 1500,
    };
    const merge = usePomodoroStore.persist.getOptions().merge;
    expect(merge).toBeDefined();

    let merged: Record<string, unknown> | undefined;
    expect(() => {
      // Fijate que el payload viejo no trae los campos nuevos: igual hidrata.
      merged = merge?.(persisted, current) as unknown as Record<string, unknown>;
    }).not.toThrow();
    expect(merged?.['focusTarget']).toBeNull();
    expect(merged?.['history']).toEqual([]);
    expect(merged?.['running']).toBe(true);
    expect(typeof merged?.['secondsLeft']).toBe('number');
  });

  it('merge conserva el objetivo al reabrir a media sesión y sanea lo corrupto', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T10:00:00.000Z'));
    const target: FocusTarget = { kind: 'milestone', goalId: 'g1', milestoneId: 'm1' };
    const persisted = {
      minutes: 25,
      notifyOnComplete: false,
      dayKey: '2026-09-05',
      sessions: 0,
      focusMinutes: 0,
      running: true,
      targetEndTime: Date.now() + 60_000,
      focusTarget: target,
      history: [{ dayKey: '2026-09-04', sessions: 1, minutes: 25 }],
    };
    const current = { ...usePomodoroStore.getState(), ...baseline(), secondsLeft: 1500 };
    const merge = usePomodoroStore.persist.getOptions().merge;

    const merged = merge?.(persisted, current) as unknown as {
      focusTarget: unknown;
      history: unknown;
      running: boolean;
    };
    // Reabrir a media sesión conserva el objetivo para mostrar el título.
    expect(merged.focusTarget).toEqual(target);
    expect(merged.history).toEqual([{ dayKey: '2026-09-04', sessions: 1, minutes: 25 }]);
    expect(merged.running).toBe(true);

    const corrupt = merge?.(
      { ...persisted, focusTarget: { kind: 'raro' }, history: [{ dayKey: '', sessions: -1 }] },
      current,
    ) as unknown as { focusTarget: unknown; history: unknown };
    expect(corrupt.focusTarget).toBeNull();
    expect(corrupt.history).toEqual([]);
  });

  it('persiste objetivo e historial y expone el selector de sólo lectura', async () => {
    const target: FocusTarget = { kind: 'goal', goalId: 'g9' };
    usePomodoroStore.getState().setFocusTarget(target);
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().completeSession();

    await new Promise((resolve) => setTimeout(resolve, 0));
    const raw = (await AsyncStorage.getItem(POMODORO_STORAGE_KEY)) ?? '{}';
    const payload = JSON.parse(raw) as { state: Record<string, unknown> };
    expect(payload.state.focusTarget).toEqual(target);
    expect(payload.state.history).toEqual([
      { dayKey: localDateKey(), sessions: 1, minutes: 25 },
    ]);

    // El selector que usa Semana devuelve el mismo historial del store.
    const { result } = await renderHook(() => useFocusHistory());
    expect(result.current).toEqual(usePomodoroStore.getState().history);
  });
});
