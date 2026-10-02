/**
 * Política de cadencia adaptativa (decidida en el diseño).
 *
 * El nivel define el tamaño de franja y cuántos avisos se apuntan por día. La
 * adaptación es determinista y auditable: sube si el usuario responde/abre, y
 * baja sola ante señales de fatiga. Nunca usa IA para decidir presión.
 *
 * Sin React ni Expo: funciones puras y testeables.
 */

import type {
  EngagementCadence,
  EngagementFact,
  EngagementQuietHours,
  EngagementSlot,
} from './engagementTypes';

export interface CadenceSpec {
  /** Duración de cada franja en minutos. */
  slotMinutes: number;
  /** Objetivo diario de avisos (sirve de referencia, no de techo). */
  targetPerDay: number;
}

/** Orden de menor a mayor insistencia. */
export const CADENCE_ORDER: EngagementCadence[] = ['calm', 'steady', 'present', 'demanding'];

export const CADENCE_SPECS: Record<EngagementCadence, CadenceSpec> = {
  // `present` y `demanding` alcanzan el objetivo de ~1 aviso por hora: la
  // ventana activa (07:00–22:00) admite 15 franjas de 60/45 minutos.
  calm: { slotMinutes: 180, targetPerDay: 4 },
  steady: { slotMinutes: 120, targetPerDay: 8 },
  present: { slotMinutes: 60, targetPerDay: 12 },
  demanding: { slotMinutes: 45, targetPerDay: 15 },
};

export const slotMinutesFor = (cadence: EngagementCadence): number =>
  CADENCE_SPECS[cadence].slotMinutes;

/** Rango activo [inicio, fin) dentro del día, como complemento de quiet hours. */
export interface ActiveRange {
  startMinute: number;
  endMinute: number;
}

/**
 * Complemento de las horas protegidas. Si inicio y fin coinciden se considera
 * que no hay horas protegidas y el día entero queda activo.
 */
export const activeRanges = (quietHours: EngagementQuietHours): ActiveRange[] => {
  const { startMinute, endMinute } = quietHours;
  if (startMinute === endMinute) return [{ startMinute: 0, endMinute: 24 * 60 }];
  if (startMinute > endMinute) {
    // Cruce de medianoche (p. ej. 22:00–07:00): activo de fin a inicio.
    return [{ startMinute: endMinute, endMinute: startMinute }];
  }
  // Franja protegida en medio del día: activo antes y después.
  return [
    { startMinute: 0, endMinute: startMinute },
    { startMinute: endMinute, endMinute: 24 * 60 },
  ];
};

/** Estadísticas de respuesta usadas por la adaptación (últimos 7 días). */
export interface CadenceStats {
  /** Avisos programados observados. */
  scheduled: number;
  /** Avisos abiertos o respondidos. */
  engaged: number;
}

/**
 * Siguiente nivel de cadencia. Con `adaptive` en false mantiene el nivel
 * elegido a mano; con muy poca señal se queda igual para no oscilar.
 */
export const adaptCadence = (
  current: EngagementCadence,
  stats: CadenceStats,
  adaptive: boolean,
): EngagementCadence => {
  if (!adaptive) return current;
  // Sin evidencia suficiente, no se toca: evita subir/bajar por ruido.
  if (stats.scheduled < 12) return current;
  const rate = stats.engaged / stats.scheduled;
  const index = CADENCE_ORDER.indexOf(current);
  if (rate >= 0.5) return CADENCE_ORDER[Math.min(index + 1, CADENCE_ORDER.length - 1)];
  if (rate < 0.15) return CADENCE_ORDER[Math.max(index - 1, 0)];
  return current;
};

/**
 * Estadísticas de respuesta de hechos observados. Solo cuentan franjas ya
 * alcanzadas por el reloj (días pasados y franjas de hoy que ya empezaron):
 * una franja futura no se puede juzgar y no debe inflar el denominador. Los
 * hechos `scheduled` tienen IDs deterministas, así que re-reconciliar no
 * duplica el conteo.
 */
export const computeCadenceStats = (
  slots: EngagementSlot[],
  facts: EngagementFact[],
  today: string,
  nowMinute: number,
): CadenceStats => {
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  let scheduled = 0;
  let engaged = 0;
  for (const fact of facts) {
    const slot = slotById.get(fact.slotId);
    if (!slot) continue;
    const reached = slot.dayKey < today || (slot.dayKey === today && slot.startMinute <= nowMinute);
    if (!reached) continue;
    if (fact.kind === 'scheduled') scheduled += 1;
    if (fact.kind === 'opened' || fact.kind === 'responded') engaged += 1;
  }
  return { scheduled, engaged };
};
