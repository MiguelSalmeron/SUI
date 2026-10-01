import type { Goal, Habit, GoalGravity, DayOfWeek } from '@/shared/types/models';
import type { UserIntention } from '@/shared/account/introTypes';
import type { TranslationKey } from '@/shared/i18n/translations';
import type { DailySnapshot } from '../model/gamification';
import type { SyncStatus } from '../sync/syncTypes';

/**
 * Contrato del store de productividad: datos + acciones.
 *
 * Vive aparte de `useProductivityStore` para que cada slice y los helpers de
 * runtime compartan el tipo sin depender del ensamblado del store (y sin
 * armar ciclos de importación entre slices).
 */
export type ProductivityState = {
  goals: Goal[];
  habits: Habit[];
  streak: number;
  lastCompletedDate: string | undefined;
  lastResetDate: string | undefined;
  weeklyHistory: DailySnapshot[];
  totalXp: number;
  /**
   * IDs de las entidades creadas por la siembra de arranque del primer ingreso.
   *
   * La marca vive acá y no como bandera en `Goal`/`Habit` a propósito: el
   * contrato de `@sui/contracts` viaja al backend y al espejo de Google, y
   * "esto es un ejemplo" es información de presentación, no de dominio.
   */
  seededGoalIds: string[];
  seededHabitIds: string[];
  stateLoaded: boolean;
  /**
   * Lectura local terminada y aplicada al store. Es la señal que usan las
   * vistas para decidir su esqueleto: `stateLoaded` espera además al bootstrap
   * de nube, así que no sirve para eso sin ocultar datos que ya existen (§12).
   */
  localLoaded: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;

  /**
   * Devuelve el ID de la meta creada o `null` si la validación la rechazó.
   *
   * Antes devolvía `boolean`. El ID hace falta para marcar la siembra de
   * arranque; leerlo como "el último creado" del store sería frágil.
   */
  addGoal: (payload: {
    title: string;
    deadline: string;
    gravity?: GoalGravity;
    milestones?: string[];
    mirrorToGoogle?: boolean;
    /**
     * Días que la meta impacta. Por defecto sólo el vencimiento. La siembra de
     * arranque lo usa para incluir hoy: sin eso la meta de ejemplo (+7 días)
     * no entra al timeline del día y el usuario no la ve nunca en Inicio.
     */
    impactDays?: string[];
  }) => string | null;
  updateGoal: (
    id: string,
    payload: { title: string; deadline: string; gravity: GoalGravity; mirrorToGoogle?: boolean },
  ) => boolean;
  toggleGoal: (id: string) => void;
  addMilestone: (goalId: string, title: string) => void;
  toggleMilestone: (goalId: string, milestoneId: string) => void;
  removeGoal: (id: string) => void;

  /** Igual que `addGoal`: devuelve el ID creado o `null` si la validación falla. */
  addHabit: (payload: {
    title: string;
    frequency?: 'daily' | DayOfWeek[];
    linkedGoalId?: string | null;
    plannedTime?: string;
    mirrorToGoogle?: boolean;
  }) => string | null;
  updateHabit: (
    id: string,
    payload: {
      title: string;
      frequency: 'daily' | DayOfWeek[];
      linkedGoalId: string | null;
      plannedTime?: string;
      mirrorToGoogle?: boolean;
    },
  ) => boolean;
  toggleHabit: (id: string) => void;
  freezeStreak: (habitId: string) => void;
  removeHabit: (id: string) => void;

  bumpStreak: () => void;
  loadState: () => Promise<void>;
  reloadState: () => Promise<void>;
  handleAuthUserChanged: (uid: string | null) => void;
  saveState: () => Promise<void>;
  syncNow: () => Promise<void>;
  resolveCloudMerge: (strategy: 'combine' | 'cloud') => Promise<void>;
  clearState: (options?: { preserveStorage?: boolean }) => Promise<void>;

  /**
   * Siembra el arranque del primer ingreso para la intención elegida.
   *
   * `resolve` traduce las claves del kit; entra por parámetro para que el
   * dominio no dependa de i18n ni de la funcionalidad de onboarding.
   */
  seedStarterData: (intention: UserIntention, resolve: (key: TranslationKey) => string) => void;
  /** Quita la marca de ejemplo conservando el dato (el usuario lo adopta). */
  personalizeSeeded: (id: string) => void;
  /** Borra el ejemplo y su marca. No se vuelve a sembrar nunca. */
  dismissSeeded: (id: string) => void;
  /** ¿La entidad sigue marcada como ejemplo? */
  isSeeded: (id: string) => boolean;
};

/**
 * Campos de datos del store. Se esparce antes de los slices al crear el store.
 *
 * Es una función y no un objeto constante para que cada creación (incluidos
 * los tests que recrean el store) estrene arrays propios y no comparta
 * referencias mutables.
 */
export const createInitialProductivityState = (): Pick<
  ProductivityState,
  | 'goals'
  | 'habits'
  | 'streak'
  | 'lastCompletedDate'
  | 'lastResetDate'
  | 'weeklyHistory'
  | 'totalXp'
  | 'seededGoalIds'
  | 'seededHabitIds'
  | 'stateLoaded'
  | 'localLoaded'
  | 'syncStatus'
  | 'lastSyncedAt'
> => ({
  goals: [],
  habits: [],
  streak: 0,
  lastCompletedDate: undefined,
  lastResetDate: undefined,
  weeklyHistory: [],
  totalXp: 0,
  seededGoalIds: [],
  seededHabitIds: [],
  stateLoaded: false,
  localLoaded: false,
  syncStatus: 'local',
  lastSyncedAt: null,
});
