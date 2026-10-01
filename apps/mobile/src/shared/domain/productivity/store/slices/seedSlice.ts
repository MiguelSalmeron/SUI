import type { StateCreator } from 'zustand';
import { useIntroStore } from '@/shared/account/useIntroStore';
import type { UserIntention } from '@/shared/account/introTypes';
import type { TranslationKey } from '@/shared/i18n/translations';
import { recordTelemetry } from '@/shared/observability/telemetry';
import { localDateKey } from '../../model/homeStorage';
import { STARTER_KITS } from '../../model/starterKits';
import type { ProductivityState } from '../productivityState';

export type SeedActions = Pick<
  ProductivityState,
  'seedStarterData' | 'personalizeSeeded' | 'dismissSeeded' | 'isSeeded'
>;

/**
 * Siembra de arranque del primer ingreso.
 *
 * Reutiliza `addGoal`/`addHabit` en vez de escribir al store: así hereda
 * validación, `createdAt`, `saveState` y sync sin código nuevo, y la siembra
 * se comporta como cualquier alta del usuario si algo la inspecciona.
 *
 * Las reglas que no se negocian:
 *
 * - **Forma, no pasado.** Todo nace sin completar, sin racha y sin XP. Una
 *   racha sembrada se rompe el día tres y la app se lee como engaño.
 * - **Nunca al espejo.** `mirrorToGoogle: false` explícito, porque el default
 *   de metas es `true` y "Leer 10 minutos (ejemplo)" en el Google Calendar
 *   real del usuario sería un papelón.
 * - **Doble candado.** No siembra si ya se sembró o si hay datos: volver
 *   atrás en el flujo no duplica, y un login que trae historial no recibe
 *   ejemplos encima.
 *
 * Los slices no emiten telemetría por decisión propia (`goalSlice` lo
 * documenta: los efectos van por `appEventBus`). Acá sí se emite porque el
 * sembrado no genera eventos de dominio — todavía no hay nada que celebrar— y
 * su medición es justamente el experimento completo.
 */
export const createSeedSlice: StateCreator<ProductivityState, [], [], SeedActions> = (
  set,
  get,
) => ({
  seedStarterData: (intention: UserIntention, resolve: (key: TranslationKey) => string) => {
    const intro = useIntroStore.getState();
    const { goals, habits, seededGoalIds, seededHabitIds } = get();

    // Candado 1: ya corrió. Candado 2: el usuario tiene datos propios, sembrar
    // encima metería ejemplos donde no los pidió.
    if (intro.starterSeededAt !== null) return;
    if (goals.length > 0 || habits.length > 0) return;

    const kit = STARTER_KITS[intention];
    const { addGoal, addHabit } = get();

    const nextGoalIds: string[] = [];
    const nextHabitIds: string[] = [];

    for (const goal of kit.goals) {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + goal.deadlineOffsetDays);
      const deadlineKey = localDateKey(deadline);
      const todayKey = localDateKey();
      const id = addGoal({
        title: resolve(goal.titleKey),
        deadline: deadlineKey,
        gravity: goal.gravity,
        milestones: goal.milestoneKeys.map((key) => resolve(key)),
        mirrorToGoogle: false,
        // El timeline del día sólo muestra metas que vencen hoy o lo
        // impactan. Sin el hoy acá, la meta de ejemplo (+7 días) existe en el
        // store pero es invisible en Inicio — que era toda la promesa.
        impactDays:
          deadlineKey === todayKey ? [todayKey] : [todayKey, deadlineKey],
      });
      if (id) nextGoalIds.push(id);
    }

    for (const habit of kit.habits) {
      const id = addHabit({
        title: resolve(habit.titleKey),
        frequency: 'daily',
        plannedTime: habit.plannedTime,
        mirrorToGoogle: false,
      });
      if (id) nextHabitIds.push(id);
    }

    if (nextGoalIds.length === 0 && nextHabitIds.length === 0) return;

    set({
      seededGoalIds: [...seededGoalIds, ...nextGoalIds],
      seededHabitIds: [...seededHabitIds, ...nextHabitIds],
    });
    // El candado va primero que el guardado: si `saveState` fallara, que la
    // siembra igual quede marcada y no se repita al reintentar.
    intro.markStarterSeeded(intention);

    recordTelemetry('onboarding.seed_created', {
      intention,
      goalCount: nextGoalIds.length,
      habitCount: nextHabitIds.length,
    });
  },

  personalizeSeeded: (id: string) => {
    const { seededGoalIds, seededHabitIds } = get();
    if (!seededGoalIds.includes(id) && !seededHabitIds.includes(id)) return;
    // Solo saca la marca: el usuario adopta el dato y pasa a ser suyo.
    set({
      seededGoalIds: seededGoalIds.filter((seeded) => seeded !== id),
      seededHabitIds: seededHabitIds.filter((seeded) => seeded !== id),
    });
    recordTelemetry('onboarding.seed_personalized', { id });
  },

  /**
   * Descartar borra el dato, a diferencia de `personalizeSeeded` que lo
   * conserva. El candado de `starterSeededAt` ya quedó marcado al sembrar, así
   * que vaciar Inicio acá es una decisión del usuario y no vuelve a pasar.
   *
   * La telemetría vive acá y no en el banner: así el componente de UI no
   * importa observabilidad y el evento sale aunque el descarte venga de otro
   * lugar.
   */
  dismissSeeded: (id: string) => {
    const { seededGoalIds, seededHabitIds } = get();
    const isGoal = seededGoalIds.includes(id);
    const isHabit = seededHabitIds.includes(id);
    if (!isGoal && !isHabit) return;

    const { removeGoal, removeHabit } = get();
    if (isGoal) removeGoal(id);
    if (isHabit) removeHabit(id);
    set({
      seededGoalIds: seededGoalIds.filter((seeded) => seeded !== id),
      seededHabitIds: seededHabitIds.filter((seeded) => seeded !== id),
    });
    recordTelemetry('onboarding.seed_dismissed', { kind: isGoal ? 'goal' : 'habit' });
  },

  isSeeded: (id: string) => get().seededGoalIds.includes(id) || get().seededHabitIds.includes(id),
});
