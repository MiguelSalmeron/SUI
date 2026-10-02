/**
 * Scheduler de Engagement.
 *
 * Traduce el plan puro de `model/slotPlanner` a las primitivas de
 * `shared/infrastructure/notifications`. No inventa reglas: solo resuelve el
 * copy i18n, el canal Android y el payload. Idempotente: re-ejecutar reemplaza
 * los mismos identificadores. Nunca solicita permisos ni lanza.
 */

import { runNotificationTask } from '@/shared/infrastructure/notificationTasks';
import { useSettingsStore } from '@/shared/preferences/useSettingsStore';
import { resolveLocale, translate } from '@/shared/i18n/i18n';
import {
  cancelScheduledNotification,
  getNotificationPermission,
  getScheduledNotificationIdentifiers,
  scheduleLocalNotification,
} from '@/shared/infrastructure/notifications';
import type { LocalNotificationChannel } from '@/shared/infrastructure/notifications';
import { ENGAGEMENT_ID_PREFIX, type PlannedEngagementAlert } from '../model/slotPlanner';
import type { EngagementProfile } from '../model/engagementTypes';

/** Canal Android propio de acompañamiento (separado de accountability). */
export const ENGAGEMENT_CHANNEL: LocalNotificationChannel = {
  id: 'engagement-companion',
  name: 'Acompañamiento',
};

/** Marca de payload para enrutar el toque del acompañamiento. */
export const ENGAGEMENT_PAYLOAD_TYPE = 'engagement_follow_up';

/** Copy resuelto con el locale actual; los valores ya vienen limitados. */
const resolveCopy = (alert: PlannedEngagementAlert): { title: string; body: string } => {
  const preference = useSettingsStore.getState().language;
  const locale = resolveLocale(preference);
  return {
    title: translate(locale, alert.titleKey as Parameters<typeof translate>[1], alert.values),
    body: translate(locale, alert.bodyKey as Parameters<typeof translate>[1], alert.values),
  };
};

const materializeAlert = async (alert: PlannedEngagementAlert): Promise<void> => {
  const { title, body } = resolveCopy(alert);
  await scheduleLocalNotification({
    identifier: alert.identifier,
    title,
    body,
    data: {
      type: ENGAGEMENT_PAYLOAD_TYPE,
      slotId: alert.slotId,
      source: alert.source,
      ...(alert.subjectType ? { subjectType: alert.subjectType } : {}),
      ...(alert.subjectId ? { subjectId: alert.subjectId } : {}),
    },
    trigger: { kind: 'date', date: alert.fireAt },
    channel: ENGAGEMENT_CHANNEL,
  });
};

export type ApplyEngagementPlanResult = {
  scheduled: number;
  cancelled: number;
  permission: 'granted' | 'denied' | 'blocked';
};

/** Cancela todas las alertas de engagement actualmente programadas. */
const cancelEngagementNotifications = async (isCurrent: () => boolean): Promise<number> => {
  if (!isCurrent()) return 0;
  const scheduled = await getScheduledNotificationIdentifiers();
  const ours = scheduled.filter((id) => id.startsWith(ENGAGEMENT_ID_PREFIX));
  let cancelled = 0;
  for (const identifier of ours) {
    if (!isCurrent()) break;
    await cancelScheduledNotification(identifier);
    cancelled += 1;
  }
  return cancelled;
};

/**
 * Consulta permiso y aplica el plan (programa + cancela). Sin permiso sólo
 * limpia la agenda del dominio, nunca alertas ajenas. Un error del SDK en una
 * alerta no aborta el resto.
 */
export const scheduleEngagementNotifications = async (input: {
  isCurrent?: () => boolean;
  profile: EngagementProfile;
  alerts: PlannedEngagementAlert[];
  cancels: string[];
}): Promise<ApplyEngagementPlanResult> =>
  runNotificationTask(async () => {
    const isCurrent = input.isCurrent ?? (() => true);
    if (!isCurrent()) return { scheduled: 0, cancelled: 0, permission: 'blocked' };
    const permission = await getNotificationPermission().catch(() => 'blocked' as const);
    if (!isCurrent()) return { scheduled: 0, cancelled: 0, permission };
    if (permission !== 'granted') {
      const cancelled = await cancelEngagementNotifications(isCurrent);
      return { scheduled: 0, cancelled, permission };
    }

    let scheduled = 0;
    for (const alert of input.alerts) {
      if (!isCurrent()) break;
      try {
        await materializeAlert(alert);
        if (!isCurrent()) {
          await cancelScheduledNotification(alert.identifier);
          break;
        }
        scheduled += 1;
      } catch {
        // Alerta individual fallida no aborta el resto.
      }
    }
    let cancelled = 0;
    for (const identifier of input.cancels) {
      if (!isCurrent()) break;
      try {
        await cancelScheduledNotification(identifier);
        cancelled += 1;
      } catch {
        // idem
      }
    }
    return { scheduled, cancelled, permission };
  });

export const cancelAllEngagementNotifications = (
  isCurrent: () => boolean = () => true,
): Promise<number> => runNotificationTask(() => cancelEngagementNotifications(isCurrent));
