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
  getSessionMinutes,
  POMODORO_MAX_MINUTES,
  POMODORO_MIN_MINUTES,
  POMODORO_STORAGE_KEY,
  useFocusHistory,
  usePomodoroStore,
} from '../store/usePomodoroStore';

const baseline = () => ({
  minutes: DEFAULT_POMODORO_MINUTES,
  sessionMinutes: null as number | null,
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
    expect(payload.state.history).toEqual([{ dayKey: localDateKey(), sessions: 1, minutes: 25 }]);

    // El selector que usa Semana devuelve el mismo historial del store.
    const { result } = await renderHook(() => useFocusHistory());
    expect(result.current).toEqual(usePomodoroStore.getState().history);
  });

  it('cambiar de paso en reposo vuelve a duración completa (idle)', () => {
    // Acá se simula completar y enfocar otro paso: quedás en idle listo para arrancar.
    usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h1' });
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().completeSession();
    expect(usePomodoroStore.getState().secondsLeft).toBe(0);

    usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h2' });

    const state = usePomodoroStore.getState();
    expect(state.focusTarget).toEqual({ kind: 'habit', habitId: 'h2' });
    expect(state.running).toBe(false);
    expect(state.secondsLeft).toBe(state.minutes * 60);
  });

  it('repetir el mismo paso en reposo no reinicia la cuenta', () => {
    // Si volvés al mismo paso, se respeta lo que ya llevás pausado.
    usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h1' });
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().syncRemaining(900);
    usePomodoroStore.getState().pause();

    usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h1' });

    expect(usePomodoroStore.getState().secondsLeft).toBe(900);
  });

  it('cambiar de paso a media sesión conserva objetivo y cuenta', () => {
    usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h1' });
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().syncRemaining(800);

    usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h2' });

    const state = usePomodoroStore.getState();
    expect(state.focusTarget).toEqual({ kind: 'habit', habitId: 'h1' });
    expect(state.running).toBe(true);
    expect(state.secondsLeft).toBe(800);
  });
  it('prepara 10 minutos del paso y persiste 25 como preferencia global', async () => {
    usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h1' }, 10);
    expect(usePomodoroStore.getState()).toMatchObject({
      minutes: 25,
      sessionMinutes: 10,
      secondsLeft: 600,
      running: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const payload = JSON.parse((await AsyncStorage.getItem(POMODORO_STORAGE_KEY))!);
    expect(payload.state).toMatchObject({ minutes: 25, sessionMinutes: 10 });
  });

  it('ajustar y reiniciar el paso conserva la preferencia y el objetivo', () => {
    const target = { kind: 'habit', habitId: 'h1' } as const;
    usePomodoroStore.getState().setFocusTarget(target, 10);
    usePomodoroStore.getState().setSessionMinutes(12);
    usePomodoroStore.getState().setMinutes(40);
    expect(usePomodoroStore.getState()).toMatchObject({
      minutes: 40,
      sessionMinutes: 12,
      secondsLeft: 720,
      focusTarget: target,
    });
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().syncRemaining(300);
    usePomodoroStore.getState().reset();
    expect(usePomodoroStore.getState()).toMatchObject({
      minutes: 40,
      sessionMinutes: 12,
      secondsLeft: 720,
    });
  });

  it('en pausa conserva el bloque y sólo prepara otro paso después de reiniciar', () => {
    const target = { kind: 'habit', habitId: 'h1' } as const;
    usePomodoroStore.getState().setFocusTarget(target, 10);
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().syncRemaining(400);
    usePomodoroStore.getState().pause();
    usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h2' }, 50);
    expect(usePomodoroStore.getState()).toMatchObject({
      focusTarget: target,
      sessionMinutes: 10,
      secondsLeft: 400,
      minutes: 25,
    });
    usePomodoroStore.getState().reset();
    usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h2' }, 15);
    expect(usePomodoroStore.getState()).toMatchObject({
      sessionMinutes: 15,
      secondsLeft: 900,
      minutes: 25,
    });
  });

  it('el historial cuenta 10 reales aunque cambie la preferencia global durante la sesión', () => {
    usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h1' }, 10);
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().setMinutes(40);
    usePomodoroStore.getState().setSessionMinutes(50);
    usePomodoroStore.getState().completeSession();
    usePomodoroStore.getState().completeSession();
    expect(usePomodoroStore.getState()).toMatchObject({
      minutes: 40,
      focusMinutes: 10,
      sessions: 1,
    });
    expect(usePomodoroStore.getState().history).toEqual([
      { dayKey: localDateKey(), sessions: 1, minutes: 10 },
    ]);
  });

  it('la sesión libre recupera la preferencia después de un paso contextual', () => {
    usePomodoroStore.getState().setMinutes(40);
    usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h1' }, 10);
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().completeSession();
    usePomodoroStore.getState().setFocusTarget(null);
    expect(usePomodoroStore.getState()).toMatchObject({
      minutes: 40,
      sessionMinutes: null,
      secondsLeft: 2400,
      focusTarget: null,
    });
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().completeSession();
    expect(usePomodoroStore.getState().focusMinutes).toBe(50);
  });

  it.each([NaN, Infinity, -10, 0])(
    'duración contextual inválida %s usa la preferencia',
    (duration) => {
      usePomodoroStore.getState().setMinutes(40);
      usePomodoroStore.getState().setFocusTarget({ kind: 'habit', habitId: 'h1' }, duration);
      expect(getSessionMinutes(usePomodoroStore.getState())).toBe(40);
      expect(usePomodoroStore.getState().minutes).toBe(40);
    },
  );

  it('rehidrata una sesión de 10 minutos sin cambiar los 25 habituales', async () => {
    const target = { kind: 'habit', habitId: 'h1' } as const;
    usePomodoroStore.getState().setFocusTarget(target, 10);
    usePomodoroStore.getState().start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const persisted = (await AsyncStorage.getItem(POMODORO_STORAGE_KEY))!;
    usePomodoroStore.setState(baseline());
    await new Promise((resolve) => setTimeout(resolve, 0));
    await AsyncStorage.setItem(POMODORO_STORAGE_KEY, persisted);
    await usePomodoroStore.persist.rehydrate();
    const reopened = usePomodoroStore.getState();
    expect(reopened).toMatchObject({
      minutes: 25,
      sessionMinutes: 10,
      focusTarget: target,
      running: true,
    });
    expect(reopened.secondsLeft).toBeGreaterThanOrEqual(599);
    expect(reopened.secondsLeft).toBeLessThanOrEqual(600);
    reopened.completeSession();
    expect(usePomodoroStore.getState().focusMinutes).toBe(10);
  });

  it('payload viejo sin duración contextual conserva su duración habitual', () => {
    const merge = usePomodoroStore.persist.getOptions().merge!;
    const state = merge(
      { ...baseline(), minutes: 40, sessionMinutes: undefined },
      usePomodoroStore.getState(),
    );
    expect(state.minutes).toBe(40);
    expect(state.sessionMinutes).toBeNull();
    expect(state.secondsLeft).toBe(2400);
  });
});
