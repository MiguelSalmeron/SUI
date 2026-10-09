import type { FocusTarget } from './focusTypes';
import type { Goal, TimelineItem } from '@/shared/types/models';

// Acá se compara por valor: dos objetos distintos con el mismo paso cuentan
// como el mismo objetivo, dale, así la navegación no duplica sesiones.
export function sameFocusTarget(a: FocusTarget | null, b: FocusTarget | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'habit' && b.kind === 'habit') return a.habitId === b.habitId;
  if (a.kind === 'goal' && b.kind === 'goal') return a.goalId === b.goalId;
  if (a.kind === 'milestone' && b.kind === 'milestone') {
    return a.goalId === b.goalId && a.milestoneId === b.milestoneId;
  }
  return false;
}

// Convierte lo que Hoy muestra (timeline) en el objetivo que Pomodoro entiende.
// Fijate que las metas con hitos enfocan el primer hito pendiente en vez de la
// meta entera: la meta sola no se puede completar de un toque (A1 la deja como
// not_completable), el hito sí avanza de verdad.
export function timelineItemToFocusTarget(item: TimelineItem, goals: Goal[]): FocusTarget | null {
  if (item.origin === 'habit') {
    return { kind: 'habit', habitId: item.originalId };
  }
  if (item.origin === 'goal') {
    const goal = goals.find((candidate) => candidate.id === item.originalId);
    if (!goal) return null;
    const pending = goal.milestones.find((milestone) => !milestone.completed);
    if (pending) {
      return { kind: 'milestone', goalId: goal.id, milestoneId: pending.id };
    }
    return { kind: 'goal', goalId: goal.id };
  }
  return null;
}

// Siguiente paso lógico sin reordenar nada: la lista ya viene ordenada por el
// dominio (timeline o plan del día), acá sólo se salta el actual para no
// ofrecerlo dos veces seguidas. Recibe pasos con forma mínima para no atar
// Pomodoro al modelo de Inicio y evitar el ciclo entre features.
export function nextFocusTarget(
  steps: readonly { target: FocusTarget }[],
  current: FocusTarget | null,
): FocusTarget | null {
  for (const step of steps) {
    if (!sameFocusTarget(step.target, current)) return step.target;
  }
  return null;
}
