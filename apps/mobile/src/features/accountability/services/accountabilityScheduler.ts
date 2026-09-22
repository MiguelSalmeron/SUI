/**
 * Scheduler de Accountability (Fase 2) — plan §7.2.
 *
 * Traduce el plan puro de `model/notificationPlan` a las primitivas de
 * `shared/infrastructure/notifications`. Sin reglas de negocio propias:
 * decide sólo cómo materializar (canales, copy i18n, payload) lo que el
 * planificador determinó. Idempotente: re-ejecutar reemplaza los mismos
 * identificadores, nunca duplica. Nunca solicita permisos ni lanza.
 */

import { useSettingsStore } from '@/shared/preferences/useSettingsStore';
import { resolveLocale, translate } from '@/shared/i18n/i18n';
import {
  cancelScheduledNotification,
  getNotificationPermission,
  getScheduledNotificationIdentifiers,
  scheduleLocalNotification,
} from '@/shared/infrastructure/notifications';
import type { LocalNotificationChannel } from '@/shared/infrastructure/notifications';
import { planNotifications, type PlannedAlert } from '../model/notificationPlan';
import type {
  AccountabilityCommitment,
  AccountabilityProfile,
  FollowUpCycle,
} from '../model/accountabilityTypes';

/** Canal Android propio de accountability (plan §7.2: canales separados). */
export const ACCOUNTABILITY_CHANNEL: LocalNotificationChannel = {
  id: 'accountability',
  name: 'Seguimiento de compromisos',
};

/** Prefijo de identificadores del dominio (plan §7.2). */
export const ACCOUNTABILITY_ID_PREFIX = 'sui-accountability:';

/** Marca de payload para enrutar el toque hacia el check-in (Fase 3). */
export const ACCOUNTABILITY_PAYLOAD_TYPE = 'accountability_follow_up';

export const ACCOUNTABILITY_DIGEST_PAYLOAD_TYPE = 'accountability_digest';

const commitmentById = new Map<string, AccountabilityCommitment>();

const rememberCommitments = (commitments: AccountabilityCommitment[]): void => {
  commitmentById.clear();
  for (const commitment of commitments) commitmentById.set(commitment.id, commitment);
};

/** Copy resuelto con el locale actual; nunca interpola contenido sin límite. */
const resolveCopy = (alert: PlannedAlert): { title: string; body: string } => {
  const preference = useSettingsStore.getState().language;
  const locale = resolveLocale(preference);
  if (alert.kind === 'digest') {
    return {
      title: translate(locale, alert.titleKey as Parameters<typeof translate>[1]),
      body: translate(locale, alert.bodyKey as Parameters<typeof translate>[1], alert.summary),
    };
  }
  const action = commitmentById.get(alert.commitmentId)?.nextAction ?? '';
  const values = { action: action.slice(0, 120) };
  const message = translate(locale, alert.messageKey as Parameters<typeof translate>[1], values);
  return {
    title: translate(locale, alert.titleKey as Parameters<typeof translate>[1]),
    body: translate(locale, alert.bodyKey as Parameters<typeof translate>[1], { message }),
  };
};

const materializeAlert = async (alert: PlannedAlert): Promise<void> => {
  const { title, body } = resolveCopy(alert);
  await scheduleLocalNotification({
    identifier: alert.identifier,
    title,
    body,
    data:
      alert.kind === 'digest'
        ? { type: ACCOUNTABILITY_DIGEST_PAYLOAD_TYPE, period: alert.period, stage: alert.stage }
        : {
            type: ACCOUNTABILITY_PAYLOAD_TYPE,
            commitmentId: alert.commitmentId,
            cycleId: alert.cycleId,
            stage: alert.stage,
          },
    trigger: { kind: 'date', date: alert.fireAt },
    channel: ACCOUNTABILITY_CHANNEL,
  });
};

export type ApplyPlanResult = {
  scheduled: number;
  cancelled: number;
  permission: 'granted' | 'denied' | 'blocked';
};

/**
 * Consulta permiso, construye el plan y lo aplica (programa + cancela).
 * Idempotente y silenciosa ante fallos del SDK: un error de Expo nunca rompe
 * la app (plan §12, integración móvil).
 */
export const scheduleAccountabilityNotifications = async (input: {
  profile: AccountabilityProfile;
  commitments: AccountabilityCommitment[];
  cycles: FollowUpCycle[];
  now?: Date;
  horizonDays?: number;
}): Promise<ApplyPlanResult> => {
  const permission = await getNotificationPermission().catch(() => 'blocked' as const);
  if (permission !== 'granted') {
    // Sin permiso: aseguramos limpiar la agenda previa del dominio.
    const previous = await getScheduledNotificationIdentifiers();
    const stale = previous.filter((id) => id.startsWith(ACCOUNTABILITY_ID_PREFIX));
    for (const identifier of stale) await cancelScheduledNotification(identifier);
    return { scheduled: 0, cancelled: stale.length, permission };
  }

  rememberCommitments(input.commitments);
  const scheduledIdentifiers = await getScheduledNotificationIdentifiers();
  const plan = planNotifications({
    profile: input.profile,
    commitments: input.commitments,
    cycles: input.cycles,
    now: input.now ?? new Date(),
    permission,
    scheduledIdentifiers,
    ...(input.horizonDays !== undefined ? { horizonDays: input.horizonDays } : {}),
  });

  let scheduled = 0;
  for (const alert of plan.alerts) {
    try {
      await materializeAlert(alert);
      scheduled += 1;
    } catch {
      // Alerta individual fallida no aborta el resto.
    }
  }
  let cancelled = 0;
  for (const identifier of plan.cancels) {
    try {
      await cancelScheduledNotification(identifier);
      cancelled += 1;
    } catch {
      // idem
    }
  }
  return { scheduled, cancelled, permission };
};

/** Cancela todas las alertas de accountability actualmente programadas. */
export const cancelAllAccountabilityNotifications = async (): Promise<number> => {
  const scheduled = await getScheduledNotificationIdentifiers();
  const ours = scheduled.filter((id) => id.startsWith(ACCOUNTABILITY_ID_PREFIX));
  for (const identifier of ours) await cancelScheduledNotification(identifier);
  return ours.length;
};
