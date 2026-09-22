/**
 * API pura del dominio de productividad: sin I/O, sin Firebase, sin stores.
 * Segura para importar desde tests y desde features sin arrastrar auth/sync.
 */
export {
  calculateLevel,
  getAchievements,
  getCompletionRate,
  getWeeklyInsight,
  buildWeeklyView,
  type Achievement,
  type DailySnapshot,
} from './model/gamification';
export { isHabitDueToday, localDateKey } from './model/homeStorage';
export {
  shouldMirrorGoal,
  shouldMirrorHabit,
  DEFAULT_MIRROR_PREFS,
  DEFAULT_GOAL_MIRROR,
  DEFAULT_HABIT_MIRROR,
} from './model/mirror';
