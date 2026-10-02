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
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
}));

let mockLanguage: 'es' | 'en' = 'es';
jest.mock('@/shared/preferences/useSettingsStore', () => ({
  useSettingsStore: { getState: () => ({ language: mockLanguage }) },
}));

import * as Notifications from 'expo-notifications';
import {
  cancelAllEngagementNotifications,
  ENGAGEMENT_CHANNEL,
  ENGAGEMENT_PAYLOAD_TYPE,
  scheduleEngagementNotifications,
} from '../services/engagementScheduler';
import { ENGAGEMENT_ID_PREFIX, type PlannedEngagementAlert } from '../model/slotPlanner';
import { DEFAULT_ENGAGEMENT_PROFILE } from '../model/engagementTypes';

const profile = {
  ...DEFAULT_ENGAGEMENT_PROFILE,
  enabled: true,
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const alert: PlannedEngagementAlert = {
  identifier: `${ENGAGEMENT_ID_PREFIX}2026-09-08:600`,
  slotId: '2026-09-08:600',
  dayKey: '2026-09-08',
  startMinute: 600,
  fireAt: new Date(2026, 8, 8, 10, 0, 0),
  source: 'habit_due',
  subjectType: 'habit',
  subjectId: 'h1',
  titleKey: 'engagement.habitDue.title',
  bodyKey: 'engagement.habitDue.body',
  values: { title: 'Leer' },
};

describe('engagementScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'es';
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
    } as never);
    jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([] as never);
  });

  it('asegura el canal y programa con payload enrutable', async () => {
    const result = await scheduleEngagementNotifications({ profile, alerts: [alert], cancels: [] });
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      ENGAGEMENT_CHANNEL.id,
      expect.objectContaining({ name: ENGAGEMENT_CHANNEL.name }),
    );
    expect(result.scheduled).toBe(1);
    const call = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.identifier).toBe(alert.identifier);
    expect(call.content.title).toContain('Leer');
    expect(call.content.data).toMatchObject({
      type: ENGAGEMENT_PAYLOAD_TYPE,
      slotId: '2026-09-08:600',
      source: 'habit_due',
    });
  });

  it('resuelve el copy en inglés', async () => {
    mockLanguage = 'en';
    await scheduleEngagementNotifications({ profile, alerts: [alert], cancels: [] });
    const call = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.title).toContain('Still due');
  });

  it('sin permiso limpia la agenda del dominio y no programa', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as never);
    jest
      .mocked(Notifications.getAllScheduledNotificationsAsync)
      .mockResolvedValue([{ identifier: `${ENGAGEMENT_ID_PREFIX}old:600` }] as never);
    const result = await scheduleEngagementNotifications({ profile, alerts: [alert], cancels: [] });
    expect(result.scheduled).toBe(0);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      `${ENGAGEMENT_ID_PREFIX}old:600`,
    );
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('cancela todo lo del dominio sin tocar alertas ajenas', async () => {
    jest
      .mocked(Notifications.getAllScheduledNotificationsAsync)
      .mockResolvedValue([
        { identifier: `${ENGAGEMENT_ID_PREFIX}a:600` },
        { identifier: 'sui-nightly-report' },
      ] as never);
    const cancelled = await cancelAllEngagementNotifications();
    expect(cancelled).toBe(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      `${ENGAGEMENT_ID_PREFIX}a:600`,
    );
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
      'sui-nightly-report',
    );
  });
});
