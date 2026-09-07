/**
 * Primitivas compartidas de notificaciones push LOCALES (expo-notifications).
 *
 * Arquitectura 100% local / offline: las alertas se programan en el propio
 * dispositivo y nunca salen del teléfono. Este módulo es la única capa que
 * toca expo-notifications; las features (p. ej. reporte nocturno o el final
 * de una sesión Pomodoro) describen qué notificar y este módulo se encarga
 * del canal de Android, el trigger y la programación.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'blocked';

export type LocalNotificationTrigger =
  { kind: 'date'; date: Date } | { kind: 'daily'; hour: number; minute: number };

export type LocalNotificationChannel = { id: string; name: string };

export type LocalNotificationRequest = {
  /** Identificador estable: re-programar reemplaza, no duplica. */
  identifier: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  trigger: LocalNotificationTrigger;
  /** Canal Android donde se entrega la alerta (se ignora en iOS). */
  channel: LocalNotificationChannel;
};

/**
 * Handler global: muestra la notificación incluso con la app en primer plano.
 * Debe registrarse una sola vez al inicio de la app.
 */
export const configureNotificationHandler = (): void => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
};

const permissionStatus = (permission: {
  granted: boolean;
  canAskAgain: boolean;
}): NotificationPermissionStatus => {
  if (permission.granted) return 'granted';
  return permission.canAskAgain ? 'denied' : 'blocked';
};

/** Consulta el permiso actual sin solicitarlo nunca. */
export const getNotificationPermission = async (): Promise<NotificationPermissionStatus> => {
  return permissionStatus(await Notifications.getPermissionsAsync());
};

/**
 * Solicita permiso sólo si el estado actual lo permite (previamente negado
 * pero re-preguntable). Devuelve el estado resultante sin lanzar.
 */
export const requestNotificationPermission = async (): Promise<NotificationPermissionStatus> => {
  const current = await getNotificationPermission();
  if (current !== 'denied') return current;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted ? 'granted' : 'denied';
};

/** Cancela una notificación programada; no-op silencioso si no existe. */
export const cancelScheduledNotification = async (identifier: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
};

const buildExpoTrigger = (
  trigger: LocalNotificationTrigger,
  channelId?: string,
): Notifications.NotificationTriggerInput => {
  const channel = channelId ? { channelId } : {};
  if (trigger.kind === 'daily') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: trigger.hour,
      minute: trigger.minute,
      ...channel,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: trigger.date,
    ...channel,
  };
};

/**
 * Programa (o re-programa) una notificación local. En Android asegura el
 * canal antes de agendar. Crea el canal si hace falta; no solicita permisos.
 */
export const scheduleLocalNotification = async (
  request: LocalNotificationRequest,
): Promise<void> => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(request.channel.id, {
      name: request.channel.name,
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: undefined,
    });
  }

  const channelId = Platform.OS === 'android' ? request.channel.id : undefined;
  await Notifications.scheduleNotificationAsync({
    identifier: request.identifier,
    content: {
      title: request.title,
      ...(request.body ? { body: request.body } : {}),
      ...(request.data ? { data: request.data } : {}),
    },
    trigger: buildExpoTrigger(request.trigger, channelId),
  });
};
