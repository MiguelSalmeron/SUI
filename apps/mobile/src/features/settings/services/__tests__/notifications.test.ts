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

import { isNightlyReportResponse, NIGHTLY_REPORT_TYPE } from '../notifications';

describe('notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
