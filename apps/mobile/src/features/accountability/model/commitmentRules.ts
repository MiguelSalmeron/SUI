/**
 * Reglas puras de ciclo, ventanas y escalamiento (Fase 1).
 *
 * Sin React, sin Expo, sin almacenamiento: funciones deterministas y
 * testeables (plan §5.2, fila Dominio). Los efectos (notificaciones reales)
 * llegan en Fase 2 con el scheduler.
 */

import type {
  AccountabilityCommitment,
  AccountabilityDay,
  AccountabilityProfile,
  CycleStatus,
  FollowUpCycle,
  QuietHours,
  ScheduleRule,
} from './accountabilityTypes';

/** Máximo de intervenciones por ciclo (plan §7.3). */
export const MAX_ATTEMPTS_PER_CYCLE = 3;

/** Enfriamiento mínimo entre alertas de escalamiento, en minutos (plan §7.3). */
export const ESCALATION_COOLDOWN_MINUTES = 60;

/** Horizonte de scheduling acotado, en días (plan §7.1, punto 6). */
export const SCHEDULING_HORIZON_DAYS = 7;

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Clave de fecha local YYYY-MM-DD a partir de componentes locales del SO. */
export const toLocalDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const DAY_INDEX: AccountabilityDay[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const dayNameOf = (date: Date): AccountabilityDay => DAY_INDEX[date.getDay()];

/** Minutos desde medianoche local para una hora HH:MM. */
export const minutesOfDay = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/** ¿Está `minute` dentro de la ventana protegida? Soporta cruce de medianoche. */
export const isInQuietHours = (minute: number, quietHours: QuietHours): boolean => {
  const { startMinute, endMinute } = quietHours;
  if (startMinute === endMinute) return false;
  if (startMinute < endMinute) return minute >= startMinute && minute < endMinute;
  return minute >= startMinute || minute < endMinute;
};

/** ¿Es día de descanso según la clave local YYYY-MM-DD? */
export const isRestDay = (localDateKey: string, restDays: AccountabilityDay[]): boolean => {
  if (restDays.length === 0) return false;
  const date = new Date(`${localDateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return restDays.includes(dayNameOf(date));
};

export interface CycleWindow {
  localDate: string;
  time: string;
}

/**
 * Ocurrencias futuras de una regla de agenda dentro del horizonte, ordenadas.
 * Determinista: misma regla + misma fecha base ⇒ mismas ventanas.
 */
export const nextOccurrences = (
  schedule: ScheduleRule,
  fromDate: Date,
  horizonDays = SCHEDULING_HORIZON_DAYS,
): CycleWindow[] => {
  const today = toLocalDateKey(fromDate);
  const windows: CycleWindow[] = [];
  for (let offset = 0; offset < horizonDays; offset += 1) {
    const date = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + offset);
    const localDate = toLocalDateKey(date);
    if (schedule.kind === 'once') {
      if (schedule.date >= today && schedule.date === localDate) windows.push({ localDate, time: schedule.time });
    } else if (schedule.kind === 'daily') {
      windows.push({ localDate, time: schedule.time });
    } else if (schedule.days.includes(dayNameOf(date))) {
      windows.push({ localDate, time: schedule.time });
    }
  }
  return windows;
};

/** Instante local de inicio de la ventana (Date a partir de clave + HH:MM). */
export const windowStartAt = (localDate: string, time: string): Date =>
  new Date(`${localDate}T${time}:00`);

/**
 * ¿La ventana ya empezó? `unknown` no se infiere aquí: esto sólo dice si la
 * hora objetivo pasó (la decisión overdue/unknown la toma el reconciler).
 */
export const isWindowDue = (localDate: string, time: string, now: Date): boolean => {
  const start = windowStartAt(localDate, time);
  if (Number.isNaN(start.getTime())) return false;
  return now.getTime() >= start.getTime();
};

// ---------------------------------------------------------------------------
// Transiciones de ciclo (plan §4.3)
// ---------------------------------------------------------------------------

export type CycleEvent =
  | { type: 'schedule' }
  | { type: 'due' }
  | { type: 'acknowledge' }
  | { type: 'start' }
  | { type: 'complete'; at: string }
  | { type: 'expire' }
  | { type: 'stale' }
  | { type: 'reschedule' }
  | { type: 'reduce' }
  | { type: 'pause' }
  | { type: 'abandon' };

export type CyclePatch = { status: CycleStatus } & Partial<
  Pick<FollowUpCycle, 'attemptCount' | 'completedAt' | 'resolvedAt' | 'resolution'>
>;

const RESOLVE = (
  status: CycleStatus,
  resolution: NonNullable<FollowUpCycle['resolution']>,
) => ({
  status,
  resolvedAt: 'SET_NOW' as const,
  resolution,
});

/**
 * Máquina de estados pura del ciclo. Devuelve el parche a aplicar o `null`
 * si la transición es inválida desde el estado actual (nunca lanza).
 *
 * `attemptCount` cuenta intervenciones (alertas `due`/`overdue`), no
 * respuestas del usuario. Los eventos de resolución marcan `resolvedAt` con
 * el sentinel `SET_NOW`: el caller sustituye por el instante real.
 */
export const transitionCycle = (current: CycleStatus, event: CycleEvent): CyclePatch | null => {
  const active = !['completed', 'rescheduled', 'reduced', 'paused', 'abandoned'].includes(current);
  switch (event.type) {
    case 'schedule':
      return current === 'configured' ? { status: 'scheduled', attemptCount: 0 } : null;
    case 'due':
      return current === 'scheduled'
        ? { status: 'due', attemptCount: 1 }
        : null;
    case 'acknowledge':
      return current === 'due' ? { status: 'acknowledged', attemptCount: 1 } : null;
    case 'start':
      return current === 'due' || current === 'acknowledged'
        ? { status: 'in_progress', attemptCount: 1 }
        : null;
    case 'complete': {
      if (!['scheduled', 'due', 'acknowledged', 'in_progress'].includes(current)) return null;
      return {
        status: 'completed',
        completedAt: event.at,
        resolvedAt: 'SET_NOW' as const,
        resolution: 'completed',
      };
    }
    case 'expire':
      // El vencimiento no es una intervención: no incrementa intentos.
      if (!['scheduled', 'due'].includes(current)) return null;
      return { status: 'overdue' };
    case 'stale':
      // overdue → unknown: ausencia de datos suficientes, no fracaso (ADR-0008 §5).
      return current === 'overdue' ? { status: 'unknown' } : null;
    case 'reschedule':
      if (!active || current === 'configured') return null;
      return RESOLVE('rescheduled', 'rescheduled');
    case 'reduce':
      if (!['due', 'overdue', 'acknowledged', 'in_progress', 'scheduled'].includes(current))
        return null;
      return RESOLVE('reduced', 'reduced');
    case 'pause':
      if (!active || current === 'configured') return null;
      return RESOLVE('paused', 'paused');
    case 'abandon':
      if (!active || current === 'configured') return null;
      return RESOLVE('abandoned', 'abandoned');
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Escalamiento y límites (plan §7.3)
// ---------------------------------------------------------------------------

export type InterventionStage = 'prepare' | 'due' | 'check_in' | 'overdue' | 'review';

/**
 * Etapa de intervención aplicable al estado del ciclo, o `null` si no toca
 * notificar. Respeta el máximo por ciclo y el interruptor global.
 */
export const interventionStage = (
  status: CycleStatus,
  attemptCount: number,
  allowEscalation: boolean,
): InterventionStage | null => {
  switch (status) {
    case 'scheduled':
      return 'prepare';
    case 'due':
      return 'due';
    case 'acknowledged':
    case 'in_progress':
      return null;
    case 'overdue':
      return allowEscalation && attemptCount < MAX_ATTEMPTS_PER_CYCLE ? 'overdue' : 'review';
    case 'unknown':
      return 'review';
    default:
      return null;
  }
};

/** ¿Pasó el enfriamiento desde la última intervención? */
export const isEscalationCooldownOver = (lastInterventionAt: string, now: Date): boolean => {
  const last = new Date(lastInterventionAt).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= ESCALATION_COOLDOWN_MINUTES * 60_000;
};

/** ¿Queda margen dentro del máximo diario? */
export const canNotifyToday = (notificationsToday: number, maxPerDay: number): boolean =>
  notificationsToday < maxPerDay;

// ---------------------------------------------------------------------------
// Identificadores deterministas (plan §7.2)
// ---------------------------------------------------------------------------

/** Compromiso 1:1 por sujeto: reactivar reemplaza, no duplica. */
export const commitmentIdFor = (subjectType: 'goal' | 'habit', subjectId: string): string =>
  `acc:${subjectType}:${subjectId}`;

export const cycleIdFor = (commitmentId: string, localDate: string): string =>
  `${commitmentId}:${localDate}`;

/**
 * ID de alerta: `sui-accountability:{cycleId}:{stage}`. El cycleId ya
 * contiene el commitmentId (`acc:{type}:{subjectId}:{fecha}`), así que el
 * identificador completo es único por compromiso/ciclo/etapa sin duplicar
 * el prefijo del compromiso.
 */
export const notificationIdentifierFor = (
  cycleId: string,
  stage: InterventionStage,
): string => `sui-accountability:${cycleId}:${stage}`;

/** Fábrica de ciclo nuevo desde una ventana, con estado inicial coherente. */
export const makeCycle = (
  commitmentId: string,
  window: CycleWindow,
  _now?: string,
): FollowUpCycle => ({
  id: cycleIdFor(commitmentId, window.localDate),
  commitmentId,
  localDate: window.localDate,
  time: window.time,
  status: 'configured',
  attemptCount: 0,
});

/**
 * Intensidad efectiva: el contrato exige `intensity` siempre presente (la UI
 * la inicializa con `profile.defaultIntensity`), así que la función queda
 * como punto único de decisión para futuras variantes opcionales.
 */
export const effectiveIntensity = (
  commitment: Pick<AccountabilityCommitment, 'intensity'>,
  profile: Pick<AccountabilityProfile, 'defaultIntensity'>,
): AccountabilityCommitment['intensity'] => commitment.intensity ?? profile.defaultIntensity;
