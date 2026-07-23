/**
 * Notificaciones Push LOCALES (expo-notifications).
 *
 * Arquitectura 100% local / offline:
 *  - No usa FCM ni servidores externos. La alerta se programa en el propio
 *    dispositivo del estudiante, por lo que los datos de hábitos NUNCA salen
 *    del teléfono y la alerta funciona sin internet.
 *  - Se dispara a las 21:30 hora local (recordatorio de cierre del día).
 *  - El payload `data.type = 'nightly_report'` permite que HomeScreen detecte
 *    el toque y abra el reporte reflexivo (consulta a la IA bajo demanda).
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/** Identificador estable: re-programar reemplaza, no duplica. */
export const NIGHTLY_REPORT_ID = 'sui-nightly-report';

/** Marca de payload para enrutar el toque de la notificación. */
export const NIGHTLY_REPORT_TYPE = 'nightly_report';

/** Hora local del recordatorio nocturno. */
export const REPORT_HOUR = 21;
export const REPORT_MINUTE = 30;

const ANDROID_CHANNEL_ID = 'daily-reports';

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

/** Crea el canal de Android (no-op en iOS). Requerido para entregar alertas. */
const ensureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Reportes diarios',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: undefined,
  });
};

/**
 * Solicita permiso de notificaciones (idempotente).
 * Devuelve true si el usuario concedió el permiso.
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  if (!settings.canAskAgain) return false;

  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
};

/**
 * Programa (o re-programa) el recordatorio nocturno recurrente a las 21:30.
 * Solicita permisos si hace falta. No-op silencioso si se deniegan.
 * Devuelve true si quedó programada.
 */
export const scheduleNightlyReport = async (): Promise<boolean> => {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await ensureAndroidChannel();

  // Cancelar la previa para evitar duplicados al re-programar.
  await Notifications.cancelScheduledNotificationAsync(NIGHTLY_REPORT_ID).catch(
    () => undefined
  );

  await Notifications.scheduleNotificationAsync({
    identifier: NIGHTLY_REPORT_ID,
    content: {
      title: 'Sui está listo para escuchar 🌙',
      body: '¿Cómo te fue hoy? Toca para cerrar tu día con un resumen.',
      data: { type: NIGHTLY_REPORT_TYPE },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REPORT_HOUR,
      minute: REPORT_MINUTE,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });

  return true;
};

/** true si la respuesta a una notificación corresponde al reporte nocturno. */
export const isNightlyReportResponse = (
  response: Notifications.NotificationResponse | null
): boolean =>
  response?.notification.request.content.data?.type === NIGHTLY_REPORT_TYPE;
