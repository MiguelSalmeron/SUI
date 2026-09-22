/**
 * Reconciliador de Accountability (Fase 2) — plan §7.5.
 *
 * Repara la agenda según el reloj local, sin solicitar permisos y sin
 * bloquear el render:
 *  1. limpia la agenda si el perfil está desactivado;
 *  2. garantiza ciclos del horizonte aún alcanzables;
 *  3. aplica transiciones temporales: ventana futura → `scheduled`;
 *     ventana iniciada hoy → `due`; día vencido → `overdue`;
 *     atraso viejo → `unknown` (la ausencia de respuesta no es evidencia
 *     de fracaso, ADR-0008 §5);
 *  4. delega en el scheduler la materialización de alertas.
 *
 * Idempotente: correrla dos veces no duplica ciclos, hechos ni alertas.
 */

import { useAccountabilityStore } from '../store/useAccountabilityStore';
import {
  SCHEDULING_HORIZON_DAYS,
  cycleIdFor,
  isWindowDue,
  nextOccurrences,
  toLocalDateKey,
  type CycleEvent,
} from '../model/commitmentRules';
import {
  scheduleAccountabilityNotifications,
  cancelAllAccountabilityNotifications,
} from './accountabilityScheduler';

/** Días de atraso antes de degradar a `unknown` (plan §4.3). */
export const STALE_AFTER_DAYS = 2;

export type ReconcileResult = {
  skipped: boolean;
  commitmentsCleaned: number;
  cyclesCreated: number;
  cyclesScheduled: number;
  cyclesDue: number;
  cyclesExpired: number;
  cyclesStaled: number;
  scheduled: number;
  cancelled: number;
};

const emptyResult = (skipped = false): ReconcileResult => ({
  skipped,
  commitmentsCleaned: 0,
  cyclesCreated: 0,
  cyclesScheduled: 0,
  cyclesDue: 0,
  cyclesExpired: 0,
  cyclesStaled: 0,
  scheduled: 0,
  cancelled: 0,
});

const daysBetween = (fromDate: string, toDate: string): number => {
  const from = new Date(`${fromDate}T12:00:00`).getTime();
  const to = new Date(`${toDate}T12:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.POSITIVE_INFINITY;
  return Math.floor((to - from) / 86_400_000);
};

/**
 * Secuencia de eventos para un ciclo según su estado y el reloj local.
 * La máquina de estados valida cada paso; aquí sólo se proponen.
 */
export const cycleClockEvents = (
  status: string,
  localDate: string,
  time: string,
  now: Date,
  today: string,
): CycleEvent[] => {
  const terminal = [
    'completed',
    'rescheduled',
    'reduced',
    'paused',
    'abandoned',
    'unknown',
    'acknowledged',
    'in_progress',
  ];
  if (terminal.includes(status)) return [];

  const due = isWindowDue(localDate, time, now);
  const events: CycleEvent[] = [];

  if (!due) {
    // Ventana futura: sólo garantizar que esté programada.
    return status === 'configured' ? [{ type: 'schedule' }] : [];
  }

  const ageDays = daysBetween(localDate, today);
  const isToday = ageDays === 0;

  if (status === 'configured' || status === 'scheduled') {
    events.push({ type: 'schedule' }); // configured → scheduled
    if (isToday) {
      events.push({ type: 'due' }); // scheduled → due (ventana viva de hoy)
    } else {
      events.push({ type: 'expire' }); // scheduled → overdue (el día ya pasó)
    }
  } else if (status === 'due' && !isToday) {
    events.push({ type: 'expire' }); // due → overdue (el día ya pasó)
  }

  const endsOverdue =
    status === 'overdue' ||
    (status === 'due' && !isToday) ||
    ((status === 'configured' || status === 'scheduled') && !isToday);
  if (endsOverdue && ageDays >= STALE_AFTER_DAYS) {
    events.push({ type: 'stale' }); // overdue → unknown: sin evidencia, sin presión
  }
  return events;
};

/**
 * Ejecuta una reconciliación completa. `now` inyectable para pruebas.
 * `subjectExists` (inyectado) verifica si el goal/habit referenciado sigue
 * existiendo; los compromisos huérfanos se eliminan con sus ciclos y hechos
 * (plan §5.3, sin dejar alertas huérfanas). Todos los pasos son best-effort:
 * la app nunca se bloquea por un fallo aquí.
 */
export const reconcileAccountability = async (options?: {
  now?: Date;
  horizonDays?: number;
  subjectExists?: (subjectType: 'goal' | 'habit', subjectId: string) => boolean;
}): Promise<ReconcileResult> => {
  const now = options?.now ?? new Date();
  const horizonDays = options?.horizonDays ?? SCHEDULING_HORIZON_DAYS;
  const store = useAccountabilityStore.getState();
  if (!store.stateLoaded) return emptyResult(true);

  const today = toLocalDateKey(now);

  // --- 1. Perfil desactivado: cancelar la agenda del dominio y salir. ------
  if (!store.profile.enabled) {
    const cancelled = await cancelAllAccountabilityNotifications();
    return { ...emptyResult(), cancelled };
  }

  // --- 1b. Limpieza de compromisos huérfanos (sujeto eliminado). -----------
  let commitmentsCleaned = 0;
  if (options?.subjectExists) {
    const exists = options.subjectExists;
    for (const commitment of store.commitments) {
      if (exists(commitment.subjectType, commitment.subjectId)) continue;
      await store.removeCommitment(commitment.subjectType, commitment.subjectId);
      commitmentsCleaned += 1;
    }
  }
  // Referencias frescas tras la limpieza (sin mutar el snapshot capturado).
  const commitments = useAccountabilityStore.getState().commitments;

  // --- 2. Garantizar ciclos del horizonte aún alcanzables. -----------------
  const reachable = new Map<string, { commitmentId: string; localDate: string; time: string }>();
  for (const commitment of commitments) {
    if (!commitment.enabled) continue;
    for (const occurrence of nextOccurrences(commitment.schedule, now, horizonDays)) {
      if (occurrence.localDate < today) continue;
      reachable.set(cycleIdFor(commitment.id, occurrence.localDate), {
        commitmentId: commitment.id,
        ...occurrence,
      });
    }
  }
  const missing = [...reachable.values()].filter(
    (item) =>
      !useAccountabilityStore
        .getState()
        .cycles.some((cycle) => cycle.id === cycleIdFor(item.commitmentId, item.localDate)),
  );
  if (missing.length > 0) await store.ensureCycles(missing);
  const cyclesCreated = missing.length;

  // --- 3. Transiciones temporales por reloj local (un batch). --------------
  const events: { commitmentId: string; cycleId: string; event: CycleEvent }[] = [];
  let cyclesScheduled = 0;
  let cyclesDue = 0;
  let cyclesExpired = 0;
  let cyclesStaled = 0;

  for (const cycle of useAccountabilityStore.getState().cycles) {
    const clock = cycleClockEvents(cycle.status, cycle.localDate, cycle.time, now, today);
    if (clock.length === 0) continue;
    for (const event of clock) {
      events.push({ commitmentId: cycle.commitmentId, cycleId: cycle.id, event });
      if (event.type === 'schedule') cyclesScheduled += 1;
      if (event.type === 'due') cyclesDue += 1;
      if (event.type === 'expire') cyclesExpired += 1;
      if (event.type === 'stale') cyclesStaled += 1;
    }
  }
  if (events.length > 0) await useAccountabilityStore.getState().applyCycleEvents(events);

  // --- 4. Materializar alertas del horizonte. ------------------------------
  const fresh = useAccountabilityStore.getState();
  const plan = await scheduleAccountabilityNotifications({
    profile: fresh.profile,
    commitments: fresh.commitments,
    cycles: fresh.cycles,
    now,
    horizonDays,
  });

  return {
    skipped: false,
    commitmentsCleaned,
    cyclesCreated,
    cyclesScheduled,
    cyclesDue,
    cyclesExpired,
    cyclesStaled,
    scheduled: plan.scheduled,
    cancelled: plan.cancelled,
  };
};
