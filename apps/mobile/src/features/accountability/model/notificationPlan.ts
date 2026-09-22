/**
 * Planificador puro de notificaciones de Accountability (Fase 2) — plan §7.2.
 *
 * Entrada: perfil, compromisos, ciclos, reloj local y permiso.
 * Salida: plan determinista de alertas y cancelaciones, con identificadores
 * estables. Re-programar produce el mismo conjunto de IDs (idempotente).
 *
 * Este módulo no toca `expo-notifications`: el scheduler traduce el plan a
 * primitivas. Etapas MVP (plan §7.3): `prepare` (20 min antes), `due` (inicio
 * de ventana) y `check_in` (45 min después de iniciar la ventana). El copy se
 * resuelve en el scheduler con i18n; aquí sólo se decide qué y cuándo.
 */

import {
  SCHEDULING_HORIZON_DAYS,
  ESCALATION_COOLDOWN_MINUTES,
  commitmentIdFor,
  cycleIdFor,
  effectiveIntensity,
  interventionStage,
  isInQuietHours,
  isRestDay,
  minutesOfDay,
  nextOccurrences,
  notificationIdentifierFor,
  toLocalDateKey,
  windowStartAt,
  type InterventionStage,
} from './commitmentRules';
import type {
  AccountabilityCommitment,
  AccountabilityIntensity,
  AccountabilityPersonality,
  AccountabilityProfile,
  FollowUpCycle,
} from './accountabilityTypes';
import { computeAccountabilityDigest, type AccountabilityDigest } from './accountabilityInsights';

/** Minutos antes de la ventana para el aviso `prepare`. */
export const PREPARE_LEAD_MINUTES = 20;

/** Minutos después del inicio de la ventana para pedir check-in. */
export const CHECK_IN_DELAY_MINUTES = 45;

/**
 * Gracia tras una reconciliación para re-emitir alertas tardías (overdue).
 * Es la promesa MVP de “persistente al volver a la aplicación” (plan §7.1):
 * la alerta vencida se re-emite pronto, no en el pasado.
 */
export const OVERDUE_REISSUE_GRACE_MINUTES = 5;

export const DAILY_DIGEST_MINUTE = 20 * 60;

export const WEEKLY_DIGEST_MINUTE = 18 * 60;

type PlannedAlertBase = {
  identifier: string;
  stage: InterventionStage;
  /** Instante absoluto de disparo. */
  fireAt: Date;
  /** Clave i18n de título, p. ej. `accountability.due.title`. */
  titleKey: string;
  /** Clave i18n de cuerpo. */
  bodyKey: string;
};

export type PlannedCommitmentAlert = PlannedAlertBase & {
  kind: 'commitment';
  commitmentId: string;
  cycleId: string;
  messageKey: string;
};

export type PlannedDigestAlert = PlannedAlertBase & {
  kind: 'digest';
  period: 'daily' | 'weekly';
  summary: AccountabilityDigest;
};

export type PlannedAlert = PlannedCommitmentAlert | PlannedDigestAlert;

export type NotificationPlan = {
  alerts: PlannedAlert[];
  /** Identificadores que deben cancelarse (agenda previa obsoleta). */
  cancels: string[];
};

export type NotificationPlanInput = {
  profile: AccountabilityProfile;
  commitments: AccountabilityCommitment[];
  cycles: FollowUpCycle[];
  now: Date;
  /** Permiso vigente: sin permiso el plan es vacío (nunca solicita aquí). */
  permission: 'granted' | 'denied' | 'blocked';
  /** Identificadores actualmente programados en el sistema. */
  scheduledIdentifiers: string[];
  /** Horizonte de días a programar (default 7, plan §7.1). */
  horizonDays?: number;
};

const STAGE_COPY: Record<InterventionStage, { titleKey: string; bodyKey: string }> = {
  prepare: { titleKey: 'accountability.prepare.title', bodyKey: 'accountability.prepare.body' },
  due: { titleKey: 'accountability.due.title', bodyKey: 'accountability.due.body' },
  check_in: { titleKey: 'accountability.checkIn.title', bodyKey: 'accountability.checkIn.body' },
  overdue: { titleKey: 'accountability.overdue.title', bodyKey: 'accountability.overdue.body' },
  review: { titleKey: 'accountability.review.title', bodyKey: 'accountability.review.body' },
};

const PERSONALITY_BODY_COPY: Record<AccountabilityPersonality, string> = {
  coach: 'accountability.personality.coach.body',
  direct: 'accountability.personality.direct.body',
  partner: 'accountability.personality.partner.body',
  mentor: 'accountability.personality.mentor.body',
  minimal: 'accountability.personality.minimal.body',
};

type NotificationIntensity = Exclude<AccountabilityIntensity, 'custom'>;
type CommitmentStage = Exclude<InterventionStage, 'review'>;

const STAGE_MESSAGE_COPY: Record<CommitmentStage, Record<NotificationIntensity, string>> = {
  prepare: {
    soft: 'accountability.prepare.soft.message',
    firm: 'accountability.prepare.firm.message',
    demanding: 'accountability.prepare.demanding.message',
  },
  due: {
    soft: 'accountability.due.soft.message',
    firm: 'accountability.due.firm.message',
    demanding: 'accountability.due.demanding.message',
  },
  check_in: {
    soft: 'accountability.checkIn.soft.message',
    firm: 'accountability.checkIn.firm.message',
    demanding: 'accountability.checkIn.demanding.message',
  },
  overdue: {
    soft: 'accountability.overdue.soft.message',
    firm: 'accountability.overdue.firm.message',
    demanding: 'accountability.overdue.demanding.message',
  },
};

const DIGEST_COPY = {
  daily: {
    titleKey: 'accountability.review.daily.title',
    bodyKey: 'accountability.review.daily.body',
  },
  weekly: {
    titleKey: 'accountability.review.weekly.title',
    bodyKey: 'accountability.review.weekly.body',
  },
} as const;

const shiftMinutes = (base: Date, minutes: number): Date =>
  new Date(base.getTime() + minutes * 60_000);

const atLocalMinute = (base: Date, minute: number): Date =>
  new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    Math.floor(minute / 60),
    minute % 60,
  );

const daysBefore = (base: Date, days: number): string => {
  const result = new Date(base.getFullYear(), base.getMonth(), base.getDate() - days, 12);
  return toLocalDateKey(result);
};

/**
 * Plan determinista de alertas futuras dentro del horizonte.
 *
 * Reglas (plan §7.3): sólo compromisos y perfil activos; quiet hours y días
 * de descanso se respetan; máximo de avisos por día en todo el sistema;
 * etapas limitadas por `interventionStage`. Ante un plan vacío se cancela
 * todo lo previamente programado de accountability.
 */
export const planNotifications = (input: NotificationPlanInput): NotificationPlan => {
  const {
    profile,
    commitments,
    cycles,
    now,
    permission,
    scheduledIdentifiers,
    horizonDays = SCHEDULING_HORIZON_DAYS,
  } = input;

  if (!profile.enabled || permission !== 'granted') {
    // Sin actividad: cancelar sólo lo del dominio, nunca alertas ajenas.
    return {
      alerts: [],
      cancels: scheduledIdentifiers.filter((id) => id.startsWith('sui-accountability:')),
    };
  }

  const activeCommitments = new Map(
    commitments
      .filter((commitment) => commitment.enabled)
      .map((commitment) => [commitment.id, commitment]),
  );
  const cyclesByCommitment = new Map<string, FollowUpCycle[]>();
  for (const cycle of cycles) {
    if (!activeCommitments.has(cycle.commitmentId)) continue;
    const list = cyclesByCommitment.get(cycle.commitmentId) ?? [];
    list.push(cycle);
    cyclesByCommitment.set(cycle.commitmentId, list);
  }

  const candidates: PlannedAlert[] = [];

  const tryAdd = (
    commitment: AccountabilityCommitment,
    cycleId: string,
    stage: CommitmentStage,
    fireAt: Date,
  ): void => {
    if (fireAt.getTime() <= now.getTime()) return;
    if (isInQuietHours(fireAt.getHours() * 60 + fireAt.getMinutes(), profile.quietHours)) return;
    const effective = effectiveIntensity(commitment, profile);
    const intensity: NotificationIntensity = effective === 'custom' ? 'firm' : effective;
    candidates.push({
      kind: 'commitment',
      identifier: notificationIdentifierFor(cycleId, stage),
      commitmentId: commitment.id,
      cycleId,
      stage,
      fireAt,
      titleKey: STAGE_COPY[stage].titleKey,
      bodyKey: PERSONALITY_BODY_COPY[profile.personality],
      messageKey: STAGE_MESSAGE_COPY[stage][intensity],
    });
  };

  const today = toLocalDateKey(now);
  for (const commitment of activeCommitments.values()) {
    const occurrences = nextOccurrences(commitment.schedule, now, horizonDays);
    for (const occurrence of occurrences) {
      const commitmentId = commitmentIdFor(commitment.subjectType, commitment.subjectId);
      if (commitmentId !== commitment.id) continue; // defensa: ID debe derivar del sujeto
      const cycleId = cycleIdFor(commitment.id, occurrence.localDate);
      const existingCycle = cyclesByCommitment
        .get(commitment.id)
        ?.find((cycle) => cycle.id === cycleId);
      const stage = interventionStage(
        existingCycle?.status ?? 'scheduled',
        existingCycle?.attemptCount ?? 0,
        profile.allowEscalation,
      );
      if (!stage) continue;

      const start = windowStartAt(occurrence.localDate, occurrence.time);
      if (Number.isNaN(start.getTime())) continue;
      const startMinute = minutesOfDay(occurrence.time);
      if (isInQuietHours(startMinute, profile.quietHours)) continue;
      if (isRestDay(occurrence.localDate, profile.restDays)) continue;

      // Vencidas las ventanas del día (determinado por reloj local): no reprogramar.
      if (occurrence.localDate < today) continue;

      if (stage === 'prepare') {
        tryAdd(commitment, cycleId, 'prepare', shiftMinutes(start, -PREPARE_LEAD_MINUTES));
        tryAdd(commitment, cycleId, 'due', start);
        tryAdd(commitment, cycleId, 'check_in', shiftMinutes(start, CHECK_IN_DELAY_MINUTES));
      } else if (stage === 'due') {
        tryAdd(commitment, cycleId, 'due', start);
        tryAdd(commitment, cycleId, 'check_in', shiftMinutes(start, CHECK_IN_DELAY_MINUTES));
      } else if (stage === 'overdue') {
        // Una sola alerta, lo más pronto posible pero nunca en el pasado.
        const earliest = shiftMinutes(start, CHECK_IN_DELAY_MINUTES);
        const reissue = shiftMinutes(now, OVERDUE_REISSUE_GRACE_MINUTES);
        tryAdd(
          commitment,
          cycleId,
          'overdue',
          earliest.getTime() > reissue.getTime() ? earliest : reissue,
        );
      }
    }
  }

  const weekly = profile.weeklyDigestEnabled && now.getDay() === 0;
  const period = weekly ? 'weekly' : 'daily';
  const summary = computeAccountabilityDigest(cycles, weekly ? daysBefore(now, 6) : today, today);
  const digestAt = atLocalMinute(now, weekly ? WEEKLY_DIGEST_MINUTE : DAILY_DIGEST_MINUTE);
  if (
    summary.total > 0 &&
    digestAt.getTime() > now.getTime() &&
    !isRestDay(today, profile.restDays) &&
    !isInQuietHours(digestAt.getHours() * 60 + digestAt.getMinutes(), profile.quietHours)
  ) {
    candidates.push({
      kind: 'digest',
      identifier: `sui-accountability:digest:${period}:${today}:review`,
      stage: 'review',
      period,
      summary,
      fireAt: digestAt,
      ...DIGEST_COPY[period],
    });
  }

  const allocationOrder = [...candidates].sort((a, b) => {
    const day = toLocalDateKey(a.fireAt).localeCompare(toLocalDateKey(b.fireAt));
    if (day !== 0) return day;
    if (a.kind !== b.kind) return a.kind === 'digest' ? -1 : 1;
    return a.fireAt.getTime() - b.fireAt.getTime() || a.identifier.localeCompare(b.identifier);
  });
  const perDayCount = new Map<string, number>();
  let lastEscalationAt = Number.NEGATIVE_INFINITY;
  const alerts = allocationOrder.filter((alert) => {
    if (
      alert.stage === 'overdue' &&
      alert.fireAt.getTime() - lastEscalationAt < ESCALATION_COOLDOWN_MINUTES * 60_000
    ) {
      return false;
    }
    const dayKey = toLocalDateKey(alert.fireAt);
    const used = perDayCount.get(dayKey) ?? 0;
    if (used >= profile.maxNotificationsPerDay) return false;
    perDayCount.set(dayKey, used + 1);
    if (alert.stage === 'overdue') lastEscalationAt = alert.fireAt.getTime();
    return true;
  });
  alerts.sort(
    (a, b) => a.fireAt.getTime() - b.fireAt.getTime() || a.identifier.localeCompare(b.identifier),
  );

  const plannedIdentifiers = new Set(alerts.map((alert) => alert.identifier));
  const cancels = scheduledIdentifiers.filter(
    (identifier) =>
      identifier.startsWith('sui-accountability:') && !plannedIdentifiers.has(identifier),
  );

  return { alerts, cancels };
};
