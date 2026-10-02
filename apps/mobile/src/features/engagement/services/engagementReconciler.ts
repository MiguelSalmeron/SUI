/**
 * Reconciliador de Engagement.
 *
 * Reúne el estado local (productividad + hechos), construye candidatos
 * ambientales, planifica las franjas, materializa notificaciones y adapta la
 * cadencia según la respuesta observada. Nunca solicita permisos ni bloquea el
 * render: todos los pasos son best-effort.
 *
 * Frontera de ownership: las ventanas de compromiso (prepare/due/overdue) las
 * sigue programando accountability. Engagement aporta la capa de acompañamiento
 * alrededor (hábitos pendientes, avance/vencimiento de metas, racha,
 * inactividad, buckets horarios y reflexión) para no duplicar alertas.
 *
 * Un lock de módulo coalesce reconciliaciones concurrentes (mount + foreground)
 * para no intercalar escrituras; con `options` explícitas (tests) se ejecuta
 * directo, sin compartir resultado.
 */

import {
  isHabitDueToday,
  localDateKey,
  useProductivityStore,
} from '@/shared/domain/productivity/public';
import { getScheduledNotificationIdentifiers } from '@/shared/infrastructure/notifications';
import { adaptCadence, computeCadenceStats } from '../model/cadencePolicy';
import { buildAmbientCandidates } from '../model/ambientCatalog';
import { SCHEDULING_HORIZON_DAYS, planEngagement } from '../model/slotPlanner';
import { useEngagementStore } from '../store/useEngagementStore';
import {
  cancelAllEngagementNotifications,
  scheduleEngagementNotifications,
} from './engagementScheduler';

export type EngagementReconcileResult = {
  skipped: boolean;
  scheduled: number;
  cancelled: number;
  slots: number;
  cadenceChanged: boolean;
};

export type EngagementReconcileOptions = {
  now?: Date;
  horizonDays?: number;
};

const MS_PER_DAY = 86_400_000;

const emptyResult = (skipped = false): EngagementReconcileResult => ({
  skipped,
  scheduled: 0,
  cancelled: 0,
  slots: 0,
  cadenceChanged: false,
});

/** Días locales hasta una fecha `YYYY-MM-DD`; `undefined` si es inválida. */
const daysUntil = (deadline: string, now: Date): number | undefined => {
  const target = new Date(`${deadline}T12:00:00`);
  if (Number.isNaN(target.getTime())) return undefined;
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.round((target.getTime() - base.getTime()) / MS_PER_DAY);
};

const reconcileEngagementInternal = async (
  options?: EngagementReconcileOptions,
): Promise<EngagementReconcileResult> => {
  const now = options?.now ?? new Date();
  const horizonDays = options?.horizonDays ?? SCHEDULING_HORIZON_DAYS;
  const store = useEngagementStore.getState();
  if (!store.stateLoaded) return emptyResult(true);
  const version = store.sessionVersion;
  const isCurrent = () => {
    const current = useEngagementStore.getState();
    return current.stateLoaded && current.sessionVersion === version;
  };

  // --- 1. Perfil apagado: limpiar agenda del dominio y salir. --------------
  if (!store.profile.enabled) {
    const cancelled = await cancelAllEngagementNotifications(isCurrent);
    return { ...emptyResult(), cancelled };
  }

  const today = localDateKey(now);
  const nowMinute = now.getHours() * 60 + now.getMinutes();

  // --- 2. Candidatos desde el estado real de productividad. ----------------
  const { goals, habits } = useProductivityStore.getState();
  const goalsInput = goals
    .filter((goal) => !goal.completed)
    .map((goal) => {
      const deadlineInDays = daysUntil(goal.deadline, now);
      return {
        id: goal.id,
        title: goal.title,
        progress: goal.progress,
        pendingMilestones: goal.milestones.filter((milestone) => !milestone.completed).length,
        ...(deadlineInDays !== undefined ? { deadlineInDays } : {}),
      };
    });
  const habitsDue = habits
    .filter((habit) => !habit.completed && isHabitDueToday(habit, now))
    .map((habit) => ({
      id: habit.id,
      title: habit.title,
      streak: habit.streak,
      ...(habit.plannedTime ? { plannedTime: habit.plannedTime } : {}),
    }));

  const hasActivity = store.facts.some((fact) => {
    if (fact.kind !== 'opened' && fact.kind !== 'responded') return false;
    return localDateKey(new Date(fact.occurredAt)) === today;
  });

  const candidatesToday = buildAmbientCandidates({ goals: goalsInput, habitsDue, hasActivity });
  // Días futuros: solo fuentes estables (sin hábitos ni inactividad volátil).
  const candidatesFuture = buildAmbientCandidates({
    goals: goalsInput,
    habitsDue: [],
    hasActivity: true,
    stableOnly: true,
  });

  // --- 3. Plan determinista. -----------------------------------------------
  const scheduledIdentifiers = await getScheduledNotificationIdentifiers();
  if (!isCurrent()) return emptyResult(true);
  const plan = planEngagement({
    profile: store.profile,
    now,
    candidatesToday,
    candidatesFuture,
    scheduledIdentifiers,
    horizonDays,
  });

  // --- 4. Persistir franjas y hechos `scheduled` idempotentes. -------------
  await store.setSlotsFromPlan(plan.slots);
  if (!isCurrent()) return emptyResult(true);
  if (plan.slots.length > 0) {
    await store.recordScheduledFacts(plan.slots.map((slot) => slot.id));
  }

  // --- 5. Materializar alertas. --------------------------------------------
  if (!isCurrent()) return emptyResult(true);
  const applied = await scheduleEngagementNotifications({
    isCurrent,
    profile: store.profile,
    alerts: plan.alerts,
    cancels: plan.cancels,
  });

  // --- 6. Cadencia adaptativa: máximo un recálculo por día. ----------------
  if (!isCurrent()) return emptyResult(true);
  let cadenceChanged = false;
  const fresh = useEngagementStore.getState();
  if (fresh.profile.lastAdaptedOn !== today) {
    const stats = computeCadenceStats(fresh.slots, fresh.facts, today, nowMinute);
    const nextCadence = adaptCadence(fresh.profile.cadence, stats, fresh.profile.adaptive);
    cadenceChanged = nextCadence !== fresh.profile.cadence;
    await fresh.updateProfile({ cadence: nextCadence, lastAdaptedOn: today });
  }

  return {
    skipped: false,
    scheduled: applied.scheduled,
    cancelled: applied.cancelled,
    slots: plan.slots.length,
    cadenceChanged,
  };
};

let inFlight: { version: number; task: Promise<EngagementReconcileResult> } | null = null;

export const reconcileEngagement = (
  options?: EngagementReconcileOptions,
): Promise<EngagementReconcileResult> => {
  // Con opciones explícitas no se coalesce: el caller quiere su propio resultado.
  if (options !== undefined) return reconcileEngagementInternal(options);
  const version = useEngagementStore.getState().sessionVersion;
  if (inFlight?.version === version) return inFlight.task;
  const task = reconcileEngagementInternal().finally(() => {
    if (inFlight?.task === task) inFlight = null;
  });
  inFlight = { version, task };
  return task;
};
