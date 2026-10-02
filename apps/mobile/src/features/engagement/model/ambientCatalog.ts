/**
 * Catálogo de candidatos ambientales (decisión de diseño: una franja vacía se
 * rellena solo con valor real, nunca con relleno genérico).
 *
 * Todo candidato se ancla a un dato concreto: un hábito que falta, su hora
 * planeada, el avance o el vencimiento de una meta, una racha viva, una
 * inactividad observada, el contexto horario o una pregunta de reflexión sobre
 * un sujeto existente. Sin sujeto no hay candidato: mejor saltar la franja que
 * mandar humo.
 *
 * El objetivo es cubrir la ventana activa con ~1 aviso por hora sin repetir el
 * mismo texto: por eso hay fuentes ancladas en distintos buckets del día
 * (briefing, mitad del día, tarde, cierre) además de las ligadas a cada sujeto.
 *
 * Puro: sin React, sin Expo, sin I/O. El caller decide qué metas/hábitos
 * entran (ya filtrados por día y completitud).
 */

import { MAX_SUBJECT_TITLE_LENGTH, type EngagementSource } from './engagementTypes';

/** Sujeto mínimo que engagement necesita para componer copy. */
export interface EngagementSubject {
  id: string;
  title: string;
}

export interface EngagementGoalCandidate extends EngagementSubject {
  progress: number;
  /** Hitos pendientes de completar. */
  pendingMilestones: number;
  /** Días restantes hasta la fecha límite; negativos = vencida. */
  deadlineInDays?: number;
}

export interface EngagementHabitCandidate extends EngagementSubject {
  streak: number;
  /** Hora local planeada del hábito (HH:MM) si el usuario la definió. */
  plannedTime?: string;
}

export interface EngagementCandidate {
  /** Clave estable del candidato para el día. */
  key: string;
  source: EngagementSource;
  subjectType?: 'goal' | 'habit';
  subjectId?: string;
  /** Mayor gana cuando varias fuentes compiten por la misma franja. */
  priority: number;
  titleKey: string;
  bodyKey: string;
  values: Record<string, string | number>;
  /** Minuto local mínimo en que puede dispararse (contexto del aviso). */
  earliestMinute?: number;
}

export interface AmbientCatalogInput {
  /** Metas activas con avance. */
  goals: EngagementGoalCandidate[];
  /** Hábitos que tocan hoy y siguen sin marcarse. */
  habitsDue: EngagementHabitCandidate[];
  /** ¿Hubo alguna interacción de engagement hoy? Si no, entra la inactividad. */
  hasActivity: boolean;
  /**
   * Días futuros: solo fuentes estables (avance/vencimiento de meta, briefing,
   * buckets horarios y reflexión). La completitud de hábitos cambia a diario y
   * no se puede predecir.
   */
  stableOnly?: boolean;
}

const MINUTES = 60;

const clampTitle = (title: string): string => title.trim().slice(0, MAX_SUBJECT_TITLE_LENGTH);

/** Minutos desde medianoche para una hora HH:MM válida, o `null`. */
const parsePlannedMinute = (time?: string): number | null => {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * MINUTES + minutes;
};

const pendingCount = (input: AmbientCatalogInput): number =>
  input.goals.length + input.habitsDue.length;

/**
 * Construye el pool de candidatos. El orden es informativo; el planificador
 * ordena por prioridad. Cada fuente aparece, como mucho, una vez por sujeto.
 */
export const buildAmbientCandidates = (input: AmbientCatalogInput): EngagementCandidate[] => {
  const candidates: EngagementCandidate[] = [];
  const stableOnly = input.stableOnly === true;
  const hasSubjects = input.goals.length > 0 || input.habitsDue.length > 0;

  // Sin ningún sujeto no hay anclaje: ni briefing ni reflexión valen la pena.
  if (!hasSubjects) return candidates;

  const firstHabit = input.habitsDue[0];
  const anchor = firstHabit ?? input.goals[0];
  const anchorType: 'goal' | 'habit' = firstHabit ? 'habit' : 'goal';
  // Segundo sujeto para variar cuando hay más de uno; si no, cae al ancla.
  const secondary = input.habitsDue[1] ?? input.goals[1] ?? anchor;
  const secondaryType: 'goal' | 'habit' = input.habitsDue[1]
    ? 'habit'
    : input.goals[1]
      ? 'goal'
      : anchorType;

  if (!stableOnly) {
    for (const habit of input.habitsDue) {
      const title = clampTitle(habit.title);
      candidates.push({
        key: `habit_due:${habit.id}`,
        source: 'habit_due',
        subjectType: 'habit',
        subjectId: habit.id,
        priority: 90,
        titleKey: 'engagement.habitDue.title',
        bodyKey: 'engagement.habitDue.body',
        values: { title },
        earliestMinute: 8 * MINUTES,
      });
      const plannedMinute = parsePlannedMinute(habit.plannedTime);
      if (plannedMinute !== null) {
        candidates.push({
          key: `habit_planned:${habit.id}`,
          source: 'habit_planned',
          subjectType: 'habit',
          subjectId: habit.id,
          priority: 85,
          titleKey: 'engagement.habitPlanned.title',
          bodyKey: 'engagement.habitPlanned.body',
          values: { title },
          earliestMinute: plannedMinute,
        });
      }
      if (habit.streak >= 3) {
        candidates.push({
          key: `streak:${habit.id}`,
          source: 'streak',
          subjectType: 'habit',
          subjectId: habit.id,
          priority: 80,
          titleKey: 'engagement.streak.title',
          bodyKey: 'engagement.streak.body',
          values: { title, streak: habit.streak },
          earliestMinute: 9 * MINUTES,
        });
      }
    }
  }

  for (const goal of input.goals) {
    const title = clampTitle(goal.title);
    if (goal.deadlineInDays !== undefined && goal.deadlineInDays >= 0 && goal.deadlineInDays <= 3) {
      candidates.push({
        key: `goal_deadline:${goal.id}`,
        source: 'goal_deadline',
        subjectType: 'goal',
        subjectId: goal.id,
        priority: 88,
        titleKey: 'engagement.goalDeadline.title',
        bodyKey: 'engagement.goalDeadline.body',
        values: { title, days: goal.deadlineInDays },
        earliestMinute: 9 * MINUTES,
      });
    }
    if (goal.pendingMilestones > 0 && goal.progress > 0) {
      candidates.push({
        key: `goal_progress:${goal.id}`,
        source: 'goal_progress',
        subjectType: 'goal',
        subjectId: goal.id,
        priority: 70,
        titleKey: 'engagement.goalProgress.title',
        bodyKey: 'engagement.goalProgress.body',
        values: { title, progress: goal.progress },
        earliestMinute: 10 * MINUTES,
      });
    }
    candidates.push({
      key: `goal_momentum:${goal.id}`,
      source: 'goal_momentum',
      subjectType: 'goal',
      subjectId: goal.id,
      priority: 60,
      titleKey: 'engagement.goalMomentum.title',
      bodyKey: 'engagement.goalMomentum.body',
      values: { title, progress: goal.progress },
      earliestMinute: 9 * MINUTES,
    });
  }

  // Briefing: contexto del día con conteo real de pendientes.
  candidates.push({
    key: 'briefing:day',
    source: 'briefing',
    subjectType: anchorType,
    subjectId: anchor.id,
    priority: 50,
    titleKey: 'engagement.briefing.title',
    bodyKey: 'engagement.briefing.body',
    values: { count: pendingCount(input) },
    earliestMinute: 0,
  });

  // Buckets horarios: llenan la ventana con valor anclado y sin repetir copy.
  candidates.push({
    key: `midday_focus:${anchor.id}`,
    source: 'midday_focus',
    subjectType: anchorType,
    subjectId: anchor.id,
    priority: 55,
    titleKey: 'engagement.middayFocus.title',
    bodyKey: 'engagement.middayFocus.body',
    values: { title: clampTitle(anchor.title) },
    earliestMinute: 12 * MINUTES,
  });
  candidates.push({
    key: `afternoon_check:${secondary.id}`,
    source: 'afternoon_check',
    subjectType: secondaryType,
    subjectId: secondary.id,
    priority: 52,
    titleKey: 'engagement.afternoonCheck.title',
    bodyKey: 'engagement.afternoonCheck.body',
    values: { title: clampTitle(secondary.title) },
    earliestMinute: 15 * MINUTES,
  });

  if (!stableOnly && !input.hasActivity) {
    // Inactividad observada: sólo con un sujeto concreto al cual volver.
    candidates.push({
      key: `inactivity:${anchor.id}`,
      source: 'inactivity',
      subjectType: anchorType,
      subjectId: anchor.id,
      priority: 75,
      titleKey: 'engagement.inactivity.title',
      bodyKey: 'engagement.inactivity.body',
      values: { title: clampTitle(anchor.title) },
      earliestMinute: 14 * MINUTES,
    });
  }

  // Cierre y reflexión anclados a un sujeto; cubren las franjas tardías.
  candidates.push({
    key: `evening_review:${anchor.id}`,
    source: 'evening_review',
    subjectType: anchorType,
    subjectId: anchor.id,
    priority: 48,
    titleKey: 'engagement.eveningReview.title',
    bodyKey: 'engagement.eveningReview.body',
    values: { title: clampTitle(anchor.title) },
    earliestMinute: 20 * MINUTES,
  });
  candidates.push({
    key: `reflection:${secondary.id}`,
    source: 'reflection',
    subjectType: secondaryType,
    subjectId: secondary.id,
    priority: 40,
    titleKey: 'engagement.reflection.title',
    bodyKey: 'engagement.reflection.body',
    values: { title: clampTitle(secondary.title) },
    earliestMinute: 20 * MINUTES,
  });

  return candidates;
};
