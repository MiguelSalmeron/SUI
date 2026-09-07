jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
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
import { scheduleLocalNotification } from '../notifications';

describe('shared notifications (ios)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('agenda sin canal de Android ni channelId en el trigger', async () => {
    const fireAt = new Date('2026-09-05T10:00:00.000Z');
    await scheduleLocalNotification({
      identifier: 'sui-test',
      title: 'Título',
      body: 'Cuerpo',
      data: { type: 'test' },
      trigger: { kind: 'date', date: fireAt },
      channel: { id: 'test-channel', name: 'Canal de prueba' },
    });

    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'sui-test',
      content: { title: 'Título', body: 'Cuerpo', data: { type: 'test' } },
      trigger: { type: 'date', date: fireAt },
    });
  });

  it('agenda alertas diarias sin canal en iOS', async () => {
    await scheduleLocalNotification({
      identifier: 'sui-daily',
      title: 'Diario',
      trigger: { kind: 'daily', hour: 9, minute: 0 },
      channel: { id: 'daily-reports', name: 'Reportes diarios' },
    });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'sui-daily',
      content: { title: 'Diario' },
      trigger: { type: 'daily', hour: 9, minute: 0 },
    });
  });
});
