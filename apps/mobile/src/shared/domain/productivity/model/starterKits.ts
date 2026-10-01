/**
 * Kits de arranque del primer ingreso.
 *
 * El usuario nuevo abre Home con cero metas, cero hábitos y cero XP: la
 * celebración, los niveles y el reporte nocturno existen pero no se ven nunca
 * en el estado donde más importan, que es el primero. Cada kit siembra la
 * estructura mínima que deja algo completable en menos de un minuto.
 *
 * La premisa que gobierna todo este archivo: se siembra **forma, jamás
 * historial**. Nada de esto nace con `completed`, `streak` ni XP; la racha es
 * el contrato emocional con el usuario y una racha mentirosa se rompe el día
 * tres, cuando la real ni existe. El primer win tiene que ser genuino.
 *
 * Vive en el dominio y no en onboarding porque el contenido describe *qué*
 * crear, no *cómo se presenta*; las claves son i18n y se resuelven en el
 * llamador.
 */

import type { UserIntention } from '@/shared/account/introTypes';
import type { TranslationKey } from '@/shared/i18n/translations';
import type { GoalGravity } from '@/shared/types/models';

export interface StarterGoal {
  /** Clave i18n real: el tipo obliga a que exista en ES y EN. */
  titleKey: TranslationKey;
  /**
   * Días desde hoy para la fecha límite. `0` significa hoy: es lo que hace
   * que el kit de agenda aparezca en la línea de tiempo del día, que es justo
   * lo que esa intención viene a demostrar.
   */
  deadlineOffsetDays: number;
  gravity: GoalGravity;
  milestoneKeys: TranslationKey[];
}

export interface StarterHabit {
  titleKey: TranslationKey;
  /** Hora local planned en formato HH:MM; la valida `isPlannedTime`. */
  plannedTime: string;
}

export interface StarterKit {
  goals: StarterGoal[];
  habits: StarterHabit[];
}

const goalKit: StarterGoal = {
  titleKey: 'onboarding.seed.goalTitle',
  deadlineOffsetDays: 7,
  gravity: 'low',
  milestoneKeys: [
    'onboarding.seed.goalMilestone1',
    'onboarding.seed.goalMilestone2',
    'onboarding.seed.goalMilestone3',
  ],
};

const habitKit: StarterHabit = {
  titleKey: 'onboarding.seed.habitTitle',
  plannedTime: '20:00',
};

/**
 * `agenda` no siembra el kit genérico: su valor está en ver el día ordenado
 * con horas, así que trae una meta que vence hoy y un hábito a primera hora.
 * Todo local — pedir OAuth de calendario acá es fricción brava y deja la
 * activación en manos de un permiso, por eso el espejo se apaga en toda la
 * siembra.
 */
const agendaKit: StarterKit = {
  goals: [
    {
      titleKey: 'onboarding.seed.agendaGoalTitle',
      deadlineOffsetDays: 0,
      gravity: 'low',
      milestoneKeys: ['onboarding.seed.agendaMilestone1', 'onboarding.seed.agendaMilestone2'],
    },
  ],
  habits: [{ titleKey: 'onboarding.seed.agendaHabitTitle', plannedTime: '09:00' }],
};

/**
 * `explore` es el único que siembra meta y hábito juntos, y a propósito: es el
 * que pidió conocer las herramientas, así que le toca poder tocar ambos
 * toggles. Usa los mismos textos que `goal`/`habit` en vez de duplicar copy.
 *
 * Acá no se vincula hábito con meta (`linkedGoalId`): el bonus Antigravity
 * sumaría avance a la meta de ejemplo, y un 2% que el usuario no generando se
 * siente como trampa. El vínculo se deja para cuando el usuario lo cree.
 */
export const STARTER_KITS: Record<UserIntention, StarterKit> = {
  goal: { goals: [goalKit], habits: [] },
  habit: { goals: [], habits: [habitKit] },
  agenda: agendaKit,
  explore: { goals: [goalKit], habits: [habitKit] },
};
