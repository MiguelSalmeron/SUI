jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    DATE: 'date',
  },
  AndroidImportance: {
    DEFAULT: 3,
    HIGH: 4,
  },
}));

import * as Notifications from 'expo-notifications';
import {
  cancelPomodoroComplete,
  schedulePomodoroComplete,
  notifyPomodoroCompleteNow,
  isNightlyReportResponse,
  NIGHTLY_REPORT_TYPE,
  POMODORO_COMPLETE_TYPE,
} from '../notifications';

describe('notifications pomodoro', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('programa alerta con trigger DATE', async () => {
    const end = Date.now() + 60_000;
    const ok = await schedulePomodoroComplete(end);
    expect(ok).toBe(true);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'sui-pomodoro-complete',
        content: expect.objectContaining({
          data: { type: POMODORO_COMPLETE_TYPE },
        }),
        trigger: expect.objectContaining({
          type: 'date',
          date: new Date(end),
        }),
      }),
    );
  });

  it('cancela alerta pendiente', async () => {
    await cancelPomodoroComplete();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'sui-pomodoro-complete',
    );
  });

  it('notifica inmediatamente al completar en foreground', async () => {
    await notifyPomodoroCompleteNow();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: null,
        content: expect.objectContaining({
          data: { type: POMODORO_COMPLETE_TYPE },
        }),
      }),
    );
  });

  it('detecta respuesta del reporte nocturno', () => {
    expect(
      isNightlyReportResponse({
        notification: {
          request: { content: { data: { type: NIGHTLY_REPORT_TYPE } } },
        },
      } as any),
    ).toBe(true);
  });
});
