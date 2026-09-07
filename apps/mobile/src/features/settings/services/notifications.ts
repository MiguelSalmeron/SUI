/**
 * Notificaciones Push LOCALES del reporte nocturno (expo-notifications).
 *
 * Arquitectura 100% local / offline:
 *  - No usa FCM ni servidores externos. La alerta se programa en el propio
 *    dispositivo del estudiante, por lo que los datos de hábitos NUNCA salen
 *    del teléfono y la alerta funciona sin internet.
 *  - Se dispara a las 21:30 hora local (recordatorio de cierre del día).
 *  - El payload `data.type = 'nightly_report'` permite que HomeScreen detecte
 *    el toque y abra el reporte reflexivo (consulta a la IA bajo demanda).
 *
 * El scheduling, el permiso y el canal de Android viven en
 * `shared/infrastructure/notifications`; este módulo sólo describe el
 * reporte nocturno y sus preferencias.
 */

import type { NotificationResponse } from 'expo-notifications';
import { useSettingsStore } from '@/shared/preferences/useSettingsStore';
import {
  cancelScheduledNotification,
  configureNotificationHandler,
  getNotificationPermission,
  requestNotificationPermission,
  scheduleLocalNotification,
} from '@/shared/infrastructure/notifications';

export { configureNotificationHandler };

/** Identificador estable: re-programar reemplaza, no duplica. */
export const NIGHTLY_REPORT_ID = 'sui-nightly-report';

/** Marca de payload para enrutar el toque de la notificación. */
export const NIGHTLY_REPORT_TYPE = 'nightly_report';

/** Hora local del recordatorio nocturno. */
export const REPORT_HOUR = 21;
export const REPORT_MINUTE = 30;

const NIGHTLY_CHANNEL = { id: 'daily-reports', name: 'Reportes diarios' };

export type NotificationEnableResult = 'scheduled' | 'denied' | 'blocked' | 'error';

/** Cancela el recordatorio nocturno. */
export const cancelNightlyReport = async (): Promise<void> => {
  await cancelScheduledNotification(NIGHTLY_REPORT_ID);
};

/**
 * Programa (o re-programa) el recordatorio nocturno recurrente a las 21:30.
 * Solicita permisos si hace falta. No-op silencioso si se deniegan o desactivan.
 * Devuelve true si quedó programada.
 */
const programNightlyReport = async (): Promise<void> => {
  await cancelNightlyReport();
  await scheduleLocalNotification({
    identifier: NIGHTLY_REPORT_ID,
    title: 'Sui está listo para escuchar 🌙',
    body: '¿Cómo te fue hoy? Toca para cerrar tu día con un resumen.',
    data: { type: NIGHTLY_REPORT_TYPE },
    trigger: { kind: 'daily', hour: REPORT_HOUR, minute: REPORT_MINUTE },
    channel: NIGHTLY_CHANNEL,
  });
};

export const scheduleNightlyReport = async (): Promise<NotificationEnableResult> => {
  try {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      useSettingsStore.getState().setNotificationsEnabled(false);
      return permission;
    }
    await programNightlyReport();
    useSettingsStore.getState().setNotificationsEnabled(true);
    return 'scheduled';
  } catch {
    useSettingsStore.getState().setNotificationsEnabled(false);
    return 'error';
  }
};

export const disableNightlyReport = async (): Promise<void> => {
  useSettingsStore.getState().setNotificationsEnabled(false);
  await cancelNightlyReport();
};

export const reconcileNightlyReport = async (): Promise<NotificationEnableResult | 'disabled'> => {
  if (!useSettingsStore.getState().notificationsEnabled) {
    await cancelNightlyReport();
    return 'disabled';
  }
  try {
    const current = await getNotificationPermission();
    if (current !== 'granted') {
      await disableNightlyReport();
      return current;
    }
    await programNightlyReport();
    return 'scheduled';
  } catch {
    useSettingsStore.getState().setNotificationsEnabled(false);
    return 'error';
  }
};

/** true si la respuesta a una notificación corresponde al reporte nocturno. */
export const isNightlyReportResponse = (response: NotificationResponse | null): boolean =>
  response?.notification.request.content.data?.type === NIGHTLY_REPORT_TYPE;
