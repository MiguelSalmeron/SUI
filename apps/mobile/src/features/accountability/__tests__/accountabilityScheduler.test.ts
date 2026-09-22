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
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    DATE: 'date',
  },
  AndroidImportance: {
    DEFAULT: 3,
    HIGH: 4,
  },
}));

let mockLanguage: 'es' | 'en' = 'es';

jest.mock('@/shared/preferences/useSettingsStore', () => ({
  useSettingsStore: { getState: () => ({ language: mockLanguage }) },
}));

import * as Notifications from 'expo-notifications';
import {
  ACCOUNTABILITY_CHANNEL,
  ACCOUNTABILITY_ID_PREFIX,
  cancelAllAccountabilityNotifications,
  scheduleAccountabilityNotifications,
} from '../services/accountabilityScheduler';
import { DEFAULT_PROFILE } from '../model/accountabilityTypes';

const commitment = (overrides: Record<string, unknown> = {}) => ({
  id: 'acc:goal:g1',
  subjectType: 'goal' as const,
  subjectId: 'g1',
  enabled: true,
  intensity: 'firm' as const,
  nextAction: 'Ordenar imágenes del portafolio',
  schedule: { kind: 'daily' as const, time: '19:00' },
  escalation: 'reschedule_or_minimum' as const,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
});

const input = (overrides: Record<string, unknown> = {}) => ({
  profile: { ...DEFAULT_PROFILE, enabled: true, updatedAt: '2026-09-01T00:00:00.000Z' },
  commitments: [commitment()],
  cycles: [],
  now: new Date(2026, 8, 8, 12, 0, 0),
  horizonDays: 2,
  ...overrides,
});

describe('accountabilityScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'es';
    // Restaurar el permiso concedido por defecto (otras pruebas lo niegan).
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
    } as never);
    jest
      .mocked(Notifications.getAllScheduledNotificationsAsync)
      .mockResolvedValue([
        { identifier: `${ACCOUNTABILITY_ID_PREFIX}old:2026-09-01:due` },
      ] as never);
  });

  it('asegura el canal de accountability y programa con payload enrutable', async () => {
    const result = await scheduleAccountabilityNotifications(input({ horizonDays: 1 }));
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      ACCOUNTABILITY_CHANNEL.id,
      expect.objectContaining({ name: ACCOUNTABILITY_CHANNEL.name }),
    );
    expect(result.scheduled).toBeGreaterThan(0);
    const firstCall = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(firstCall.identifier).toContain(ACCOUNTABILITY_ID_PREFIX);
    expect(firstCall.content.data).toMatchObject({
      type: 'accountability_follow_up',
      commitmentId: 'acc:goal:g1',
    });
    expect(firstCall.content.title).toContain('acción');
  });

  it('es idempotente: mismos identificadores al re-ejecutar', async () => {
    const first = await scheduleAccountabilityNotifications(input({ horizonDays: 1 }));
    jest.mocked(Notifications.scheduleNotificationAsync).mockClear();
    const second = await scheduleAccountabilityNotifications(input({ horizonDays: 1 }));
    expect(second.scheduled).toBe(first.scheduled);
    const secondIds = jest
      .mocked(Notifications.scheduleNotificationAsync)
      .mock.calls.map((call) => call[0].identifier);
    expect(new Set(secondIds).size).toBe(secondIds.length); // sin duplicados
  });

  it('sin permiso: cancela la agenda del dominio y no programa', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as never);
    const result = await scheduleAccountabilityNotifications(input());
    expect(result.permission).not.toBe('granted');
    expect(result.scheduled).toBe(0);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      `${ACCOUNTABILITY_ID_PREFIX}old:2026-09-01:due`,
    );
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('cancela todo lo del dominio sin tocar alertas ajenas', async () => {
    jest
      .mocked(Notifications.getAllScheduledNotificationsAsync)
      .mockResolvedValue([
        { identifier: `${ACCOUNTABILITY_ID_PREFIX}a:1:due` },
        { identifier: 'sui-nightly-report' },
      ] as never);
    const cancelled = await cancelAllAccountabilityNotifications();
    expect(cancelled).toBe(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      `${ACCOUNTABILITY_ID_PREFIX}a:1:due`,
    );
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
      'sui-nightly-report',
    );
  });

  it('un fallo del SDK en una alerta no aborta el resto', async () => {
    jest.mocked(Notifications.scheduleNotificationAsync).mockRejectedValueOnce(new Error('boom'));
    const result = await scheduleAccountabilityNotifications(input({ horizonDays: 1 }));
    expect(result.scheduled).toBeGreaterThan(0);
  });

  it('materializa digest con claves ES y conteos', async () => {
    await scheduleAccountabilityNotifications(
      input({
        commitments: [],
        cycles: [
          {
            id: 'acc:goal:g1:2026-09-08',
            commitmentId: 'acc:goal:g1',
            localDate: '2026-09-08',
            time: '09:00',
            status: 'completed',
            attemptCount: 1,
          },
        ],
      }),
    );
    const digest = jest
      .mocked(Notifications.scheduleNotificationAsync)
      .mock.calls.map((call) => call[0])
      .find((request) => request.identifier?.includes(':digest:'));
    expect(digest?.content.title).toBe('Tu resumen de hoy');
    expect(digest?.content.body).toContain('Completadas: 1');
    expect(digest?.content.data).toMatchObject({ type: 'accountability_digest', period: 'daily' });
  });

  it('materializa digest con catálogo EN', async () => {
    mockLanguage = 'en';
    await scheduleAccountabilityNotifications(
      input({
        commitments: [],
        cycles: [
          {
            id: 'acc:goal:g1:2026-09-08',
            commitmentId: 'acc:goal:g1',
            localDate: '2026-09-08',
            time: '09:00',
            status: 'unknown',
            attemptCount: 1,
          },
        ],
      }),
    );
    const digest = jest
      .mocked(Notifications.scheduleNotificationAsync)
      .mock.calls.map((call) => call[0])
      .find((request) => request.identifier?.includes(':digest:'));
    expect(digest?.content.title).toBe("Today's summary");
    expect(digest?.content.body).toContain('No record: 1');
  });

  it('varía copy por personalidad e intensidad sin cambiar reglas', async () => {
    await scheduleAccountabilityNotifications(
      input({
        profile: {
          ...DEFAULT_PROFILE,
          enabled: true,
          personality: 'coach',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
        commitments: [commitment({ intensity: 'soft' })],
        horizonDays: 1,
      }),
    );
    const coachBody = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0].content
      .body;
    jest.mocked(Notifications.scheduleNotificationAsync).mockClear();
    await scheduleAccountabilityNotifications(
      input({
        profile: {
          ...DEFAULT_PROFILE,
          enabled: true,
          personality: 'mentor',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
        commitments: [commitment({ intensity: 'demanding' })],
        horizonDays: 1,
      }),
    );
    const mentorBody = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0].content
      .body;
    expect(coachBody).toContain('Paso a paso');
    expect(mentorBody).toContain('Punto de enfoque');
    expect(mentorBody).not.toBe(coachBody);
  });
});
