jest.mock('@/shared/i18n/i18n', () => ({
  resolveLocale: jest.fn(() => 'es'),
  translate: jest.fn((_locale: string, key: string) => `T:${key}`),
}));

jest.mock('@/shared/infrastructure/notifications', () => ({
  scheduleLocalNotification: jest.fn(async () => undefined),
  cancelScheduledNotification: jest.fn(async () => undefined),
}));

import { translate } from '@/shared/i18n/i18n';
import {
  cancelScheduledNotification,
  scheduleLocalNotification,
} from '@/shared/infrastructure/notifications';
import {
  cancelPomodoroCompleteNotification,
  POMODORO_NOTIFICATION_ID,
  POMODORO_NOTIFICATION_TYPE,
  schedulePomodoroCompleteNotification,
} from '../notifications';

describe('pomodoro notifications service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('agenda la alerta de fin con texto traducido y trigger de fecha', async () => {
    const targetEndTime = Date.parse('2026-09-05T10:25:00.000Z');

    await schedulePomodoroCompleteNotification(targetEndTime);

    expect(scheduleLocalNotification).toHaveBeenCalledWith({
      identifier: POMODORO_NOTIFICATION_ID,
      title: 'T:pomodoro.notifyTitle',
      body: 'T:pomodoro.notifyBody',
      data: { type: POMODORO_NOTIFICATION_TYPE },
      trigger: { kind: 'date', date: new Date(targetEndTime) },
      channel: { id: 'focus-sessions', name: 'Pomodoro' },
    });
    expect(translate).toHaveBeenCalledWith('es', 'pomodoro.notifyTitle');
    expect(translate).toHaveBeenCalledWith('es', 'pomodoro.notifyBody');
  });

  it('cancela la alerta pendiente con el identificador estable', async () => {
    await cancelPomodoroCompleteNotification();
    expect(cancelScheduledNotification).toHaveBeenCalledWith(POMODORO_NOTIFICATION_ID);
  });
});
