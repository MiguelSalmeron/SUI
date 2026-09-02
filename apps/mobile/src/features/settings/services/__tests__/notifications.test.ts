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
import { useSettingsStore } from '@/shared/preferences/useSettingsStore';
import {
  isNightlyReportResponse,
  NIGHTLY_REPORT_TYPE,
  reconcileNightlyReport,
  scheduleNightlyReport,
} from '../notifications';

describe('notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ notificationsEnabled: false });
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
    } as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
    } as never);
    jest.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue('id');
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

  it('activa preferencia sólo después de programar', async () => {
    await expect(scheduleNightlyReport()).resolves.toBe('scheduled');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().notificationsEnabled).toBe(true);
  });

  it('mantiene switch apagado al denegar', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as never);
    await expect(scheduleNightlyReport()).resolves.toBe('denied');
    expect(useSettingsStore.getState().notificationsEnabled).toBe(false);
  });

  it('distingue permiso bloqueado', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: false,
    } as never);
    await expect(scheduleNightlyReport()).resolves.toBe('blocked');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('apaga preferencia si programación falla', async () => {
    jest.mocked(Notifications.scheduleNotificationAsync).mockRejectedValue(new Error('failed'));
    await expect(scheduleNightlyReport()).resolves.toBe('error');
    expect(useSettingsStore.getState().notificationsEnabled).toBe(false);
  });

  it('reconcilia sin solicitar permiso', async () => {
    useSettingsStore.setState({ notificationsEnabled: true });
    await expect(reconcileNightlyReport()).resolves.toBe('scheduled');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});
