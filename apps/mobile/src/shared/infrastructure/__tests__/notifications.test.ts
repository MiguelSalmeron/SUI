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
  cancelScheduledNotification,
  configureNotificationHandler,
  getNotificationPermission,
  requestNotificationPermission,
  scheduleLocalNotification,
} from '../notifications';

describe('shared notifications (android)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
    } as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
    } as never);
  });

  it('registra el handler global de primer plano', () => {
    configureNotificationHandler();
    expect(Notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
  });

  it('devuelve granted sin volver a preguntar si ya hay permiso', async () => {
    await expect(getNotificationPermission()).resolves.toBe('granted');
    await expect(requestNotificationPermission()).resolves.toBe('granted');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('mapea denied preguntable y blocked no re-preguntable', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as never);
    await expect(getNotificationPermission()).resolves.toBe('denied');

    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: false,
    } as never);
    await expect(getNotificationPermission()).resolves.toBe('blocked');
  });

  it('solicita permiso sólo cuando el estado es denied', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: false,
    } as never);
    await expect(requestNotificationPermission()).resolves.toBe('blocked');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('pide y concede permiso tras una negativa previa', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
    } as never);
    await expect(requestNotificationPermission()).resolves.toBe('granted');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('pide y permanece denied si vuelve a negar', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as never);
    await expect(requestNotificationPermission()).resolves.toBe('denied');
  });

  it('asegura el canal y agenda una alerta de fecha única', async () => {
    const fireAt = new Date('2026-09-05T10:00:00.000Z');
    await scheduleLocalNotification({
      identifier: 'sui-test',
      title: 'Título',
      body: 'Cuerpo',
      data: { type: 'test' },
      trigger: { kind: 'date', date: fireAt },
      channel: { id: 'test-channel', name: 'Canal de prueba' },
    });

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('test-channel', {
      name: 'Canal de prueba',
      importance: 3,
      sound: undefined,
    });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'sui-test',
      content: { title: 'Título', body: 'Cuerpo', data: { type: 'test' } },
      trigger: { type: 'date', date: fireAt, channelId: 'test-channel' },
    });
  });

  it('agenda una alerta diaria con hora y canal', async () => {
    await scheduleLocalNotification({
      identifier: 'sui-daily',
      title: 'Diario',
      trigger: { kind: 'daily', hour: 21, minute: 30 },
      channel: { id: 'daily-reports', name: 'Reportes diarios' },
    });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'sui-daily',
      content: { title: 'Diario' },
      trigger: { type: 'daily', hour: 21, minute: 30, channelId: 'daily-reports' },
    });
  });

  it('cancela una alerta programada', async () => {
    await cancelScheduledNotification('sui-test');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('sui-test');
  });

  it('no lanza si la cancelación falla', async () => {
    jest
      .mocked(Notifications.cancelScheduledNotificationAsync)
      .mockRejectedValueOnce(new Error('not found'));
    await expect(cancelScheduledNotification('sui-test')).resolves.toBeUndefined();
  });
});
