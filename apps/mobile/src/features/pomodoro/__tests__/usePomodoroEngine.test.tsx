// `productivity/public` arrastra firebase (ESM) fuera del alcance de jest;
// se reemplaza por sus submódulos ligeros reales.
jest.mock('@/shared/domain/productivity/public', () => ({
  ...jest.requireActual('@/shared/domain/productivity/model/homeStorage'),
  ...jest.requireActual('@/shared/domain/productivity/store/useCelebrationStore'),
}));

jest.mock('@/shared/observability/telemetry', () => ({
  recordTelemetry: jest.fn(),
}));

jest.mock('../services/notifications', () => ({
  schedulePomodoroCompleteNotification: jest.fn(async () => undefined),
  cancelPomodoroCompleteNotification: jest.fn(async () => undefined),
}));

import { act, render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { localDateKey, useCelebrationStore } from '@/shared/domain/productivity/public';
import { recordTelemetry } from '@/shared/observability/telemetry';
import { usePomodoroEngine } from '../hooks/usePomodoroEngine';
import {
  cancelPomodoroCompleteNotification,
  schedulePomodoroCompleteNotification,
} from '../services/notifications';
import { DEFAULT_POMODORO_MINUTES, usePomodoroStore } from '../store/usePomodoroStore';

const SESSION_MS = DEFAULT_POMODORO_MINUTES * 60 * 1000;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

type EngineApi = { start: () => void; pause: () => void; resume: () => void; reset: () => void };
let engineApi: EngineApi | undefined;

const EngineHarness = () => {
  const api = usePomodoroEngine();
  useEffect(() => {
    engineApi = api;
  }, [api]);
  return <View />;
};

describe('usePomodoroEngine', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Deja que la hidratación asíncrona de persist termine antes de usar
    // fake timers, para que no haya escrituras de estado fuera de act().
    await flush();
    engineApi = undefined;
    usePomodoroStore.setState({
      minutes: DEFAULT_POMODORO_MINUTES,
      notifyOnComplete: false,
      secondsLeft: DEFAULT_POMODORO_MINUTES * 60,
      running: false,
      targetEndTime: null,
      dayKey: localDateKey(),
      sessions: 0,
      focusMinutes: 0,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('no agenda notificación al iniciar si está desactivada', async () => {
    const view = await render(<EngineHarness />);

    await act(async () => engineApi?.start());

    expect(schedulePomodoroCompleteNotification).not.toHaveBeenCalled();
    expect(usePomodoroStore.getState().running).toBe(true);
    await view.unmount();
  });

  it('agenda notificación al iniciar cuando el opt-in está activo', async () => {
    usePomodoroStore.getState().setNotifyOnComplete(true);
    const view = await render(<EngineHarness />);

    await act(async () => engineApi?.start());

    const target = usePomodoroStore.getState().targetEndTime;
    expect(target).not.toBeNull();
    expect(schedulePomodoroCompleteNotification).toHaveBeenCalledWith(target);
    await view.unmount();
  });

  it('completa la sesión al vencer el objetivo: celebra y suma estadísticas una sola vez', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T10:00:00.000Z'));
    const triggerSpy = jest
      .spyOn(useCelebrationStore.getState(), 'trigger')
      .mockImplementation(() => undefined);

    const view = await render(<EngineHarness />);
    await act(async () => engineApi?.start());

    await act(async () => {
      jest.advanceTimersByTime(SESSION_MS + 1500);
    });

    expect(usePomodoroStore.getState().running).toBe(false);
    expect(usePomodoroStore.getState().sessions).toBe(1);
    expect(usePomodoroStore.getState().focusMinutes).toBe(DEFAULT_POMODORO_MINUTES);
    expect(triggerSpy).toHaveBeenCalledTimes(1);
    expect(triggerSpy).toHaveBeenCalledWith({ kind: 'pomodoro' });
    expect(recordTelemetry).toHaveBeenCalledWith('pomodoro.completed');
    expect(cancelPomodoroCompleteNotification).toHaveBeenCalled();

    // Avanzar más tiempo no vuelve a completar ni a celebrar.
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(usePomodoroStore.getState().sessions).toBe(1);
    expect(triggerSpy).toHaveBeenCalledTimes(1);

    await view.unmount();
  });

  it('pause cancela la notificación y evita completar en background', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T10:00:00.000Z'));
    const triggerSpy = jest
      .spyOn(useCelebrationStore.getState(), 'trigger')
      .mockImplementation(() => undefined);

    const view = await render(<EngineHarness />);
    await act(async () => engineApi?.start());

    await act(async () => engineApi?.pause());
    expect(cancelPomodoroCompleteNotification).toHaveBeenCalled();
    expect(usePomodoroStore.getState().running).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(SESSION_MS + 2000);
    });
    expect(usePomodoroStore.getState().sessions).toBe(0);
    expect(triggerSpy).not.toHaveBeenCalled();

    await view.unmount();
  });

  it('resume re-programa la notificación para el nuevo fin', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T10:00:00.000Z'));
    usePomodoroStore.getState().setNotifyOnComplete(true);

    const view = await render(<EngineHarness />);
    await act(async () => engineApi?.start());
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    await act(async () => engineApi?.pause());
    await act(async () => engineApi?.resume());

    const target = usePomodoroStore.getState().targetEndTime;
    expect(schedulePomodoroCompleteNotification).toHaveBeenLastCalledWith(target);
    expect(target).toBeGreaterThan(Date.now() + 1400_000);
    await view.unmount();
  });

  it('reset cancela la notificación y detiene la sesión', async () => {
    jest.useFakeTimers();
    usePomodoroStore.getState().setNotifyOnComplete(true);

    const view = await render(<EngineHarness />);
    await act(async () => engineApi?.start());
    await act(async () => engineApi?.reset());

    expect(usePomodoroStore.getState().running).toBe(false);
    expect(usePomodoroStore.getState().secondsLeft).toBe(SESSION_MS / 1000);
    expect(cancelPomodoroCompleteNotification).toHaveBeenCalled();
    await view.unmount();
  });

  it('reconcilia al montar una sesión que venció en segundo plano', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T10:00:00.000Z'));
    const triggerSpy = jest
      .spyOn(useCelebrationStore.getState(), 'trigger')
      .mockImplementation(() => undefined);

    // Simula un reinicio: la sesión quedó persistida y ya venció.
    usePomodoroStore.setState({
      running: true,
      targetEndTime: Date.now() - 5000,
      secondsLeft: 0,
    });

    await render(<EngineHarness />);

    expect(usePomodoroStore.getState().running).toBe(false);
    expect(usePomodoroStore.getState().sessions).toBe(1);
    expect(triggerSpy).toHaveBeenCalledTimes(1);
  });
});
