/**
 * Planificador puro de franjas de Engagement.
 *
 * Convierte perfil + candidatos + reloj local en un plan determinista de
 * alertas y cancelaciones. Re-ejecutar produce el mismo conjunto de IDs
 * (idempotente por franja): el identificador es `sui-engagement:{día}:{minuto}`.
 *
 * Reglas: solo días activos, franjas dentro de la ventana activa, techo diario
 * y una franja sin candidato no se programa (nunca relleno vacío). Los días
 * futuros usan solo candidatos estables: la completitud de hábitos cambia a
 * diario y no se puede predecir.
 *
 * Sin React, sin Expo, sin I/O.
 */

import type { DayOfWeek } from '@sui/contracts';
import { activeRanges, slotMinutesFor } from './cadencePolicy';
import type { EngagementCandidate } from './ambientCatalog';
import type { EngagementProfile, EngagementSlot } from './engagementTypes';

/** Prefijo de identificadores del dominio dentro de expo-notifications. */
export const ENGAGEMENT_ID_PREFIX = 'sui-engagement:';

/** Horizonte de scheduling acotado, en días. */
export const SCHEDULING_HORIZON_DAYS = 2;

/** ID estable de alerta para una franja. */
export const engagementIdentifierFor = (dayKey: string, startMinute: number): string =>
  `${ENGAGEMENT_ID_PREFIX}${dayKey}:${startMinute}`;

/** ID estable de franja (misma clave que el identificador, sin prefijo). */
export const engagementSlotIdFor = (dayKey: string, startMinute: number): string =>
  `${dayKey}:${startMinute}`;

export interface PlannedEngagementAlert {
  identifier: string;
  slotId: string;
  dayKey: string;
  startMinute: number;
  fireAt: Date;
  source: EngagementCandidate['source'];
  subjectType?: 'goal' | 'habit';
  subjectId?: string;
  titleKey: string;
  bodyKey: string;
  values: Record<string, string | number>;
}

export interface EngagementPlan {
  alerts: PlannedEngagementAlert[];
  /** Identificadores previos del dominio que ya no corresponden. */
  cancels: string[];
  /** Franjas con contenido; se persisten para poder medir respuesta. */
  slots: EngagementSlot[];
}

export interface EngagementPlanInput {
  profile: EngagementProfile;
  now: Date;
  /** Candidatos volátiles de hoy (incluye hábitos pendientes). */
  candidatesToday: EngagementCandidate[];
  /** Candidatos estables para días futuros. */
  candidatesFuture: EngagementCandidate[];
  /** Identificadores actualmente programados en el sistema. */
  scheduledIdentifiers: string[];
  horizonDays?: number;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const DAY_INDEX: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const isRestDay = (dayKey: string, restDays: DayOfWeek[]): boolean => {
  if (restDays.length === 0) return false;
  const date = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return restDays.includes(DAY_INDEX[date.getDay()]);
};

const fireAtFor = (day: Date, startMinute: number): Date =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(startMinute / 60),
    startMinute % 60,
  );

/** Franjas (minutos de inicio) de un día según cadencia y ventana activa. */
const slotMinutesForDay = (profile: EngagementProfile): number[] => {
  const step = slotMinutesFor(profile.cadence);
  const minutes: number[] = [];
  for (const range of activeRanges(profile.quietHours)) {
    for (let minute = range.startMinute; minute < range.endMinute; minute += step) {
      minutes.push(minute);
    }
  }
  return minutes.sort((a, b) => a - b);
};

/** Prioridad mínima cuando el usuario apaga el relleno ambiental. */
const SIGNAL_PRIORITY_FLOOR = 60;

/**
 * Asigna un candidato por franja: en cada franja gana el candidato de mayor
 * prioridad que ya esté habilitado por hora y no se haya usado ese día.
 * Determinista ante empates (orden por `key`).
 */
const assignSlots = (
  day: Date,
  dayKey: string,
  startMinutes: number[],
  candidates: EngagementCandidate[],
  fillAmbient: boolean,
  maxPerDay: number,
  now: Date,
): { alerts: PlannedEngagementAlert[]; slots: EngagementSlot[] } => {
  const assigned = new Set<string>();
  const alerts: PlannedEngagementAlert[] = [];
  const slots: EngagementSlot[] = [];

  for (const startMinute of startMinutes) {
    if (alerts.length >= maxPerDay) break;
    const fireAt = fireAtFor(day, startMinute);
    if (fireAt.getTime() <= now.getTime()) continue;

    const pool = candidates
      .filter(
        (candidate) =>
          !assigned.has(candidate.key) &&
          (fillAmbient || candidate.priority >= SIGNAL_PRIORITY_FLOOR) &&
          (candidate.earliestMinute ?? 0) <= startMinute,
      )
      .sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key));
    const chosen = pool[0];
    if (!chosen) continue;

    assigned.add(chosen.key);
    const identifier = engagementIdentifierFor(dayKey, startMinute);
    alerts.push({
      identifier,
      slotId: engagementSlotIdFor(dayKey, startMinute),
      dayKey,
      startMinute,
      fireAt,
      source: chosen.source,
      ...(chosen.subjectType ? { subjectType: chosen.subjectType } : {}),
      ...(chosen.subjectId ? { subjectId: chosen.subjectId } : {}),
      titleKey: chosen.titleKey,
      bodyKey: chosen.bodyKey,
      values: chosen.values,
    });
    slots.push({
      id: engagementSlotIdFor(dayKey, startMinute),
      dayKey,
      startMinute,
      status: 'planned',
      source: chosen.source,
      ...(chosen.subjectType ? { subjectType: chosen.subjectType } : {}),
      ...(chosen.subjectId ? { subjectId: chosen.subjectId } : {}),
    });
  }

  return { alerts, slots };
};

export const planEngagement = (input: EngagementPlanInput): EngagementPlan => {
  const { profile, now, candidatesToday, candidatesFuture, scheduledIdentifiers } = input;

  if (!profile.enabled) {
    return {
      alerts: [],
      cancels: scheduledIdentifiers.filter((id) => id.startsWith(ENGAGEMENT_ID_PREFIX)),
      slots: [],
    };
  }

  const horizonDays = Math.max(1, input.horizonDays ?? SCHEDULING_HORIZON_DAYS);
  const alerts: PlannedEngagementAlert[] = [];
  const slots: EngagementSlot[] = [];

  for (let offset = 0; offset < horizonDays; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
    const dayKey = localDateKey(day);
    if (isRestDay(dayKey, profile.restDays)) continue;
    const candidates = offset === 0 ? candidatesToday : candidatesFuture;
    const dayPlan = assignSlots(
      day,
      dayKey,
      slotMinutesForDay(profile),
      candidates,
      profile.fillAmbient,
      profile.maxNotificationsPerDay,
      now,
    );
    alerts.push(...dayPlan.alerts);
    slots.push(...dayPlan.slots);
  }

  const planned = new Set(alerts.map((alert) => alert.identifier));
  const cancels = scheduledIdentifiers.filter(
    (identifier) => identifier.startsWith(ENGAGEMENT_ID_PREFIX) && !planned.has(identifier),
  );

  return { alerts, cancels, slots };
};
