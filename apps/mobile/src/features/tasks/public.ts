/**
 * Superficie pública de Google Tasks.
 *
 * Es feature aparte de `connections` a propósito. `connections` es el contrato
 * y la tarjeta genérica: si su `public.ts` exportara el hook, cualquier
 * consumidor de la tarjeta arrastraría firebase, Sentry y expo-auth-session al
 * árbol de tests y a la app. Separado, `connections/public` sigue siendo ligero
 * y sólo quien registra el provider carga la implementación.
 */
export { useGoogleTasks, GOOGLE_TASKS_SCOPE } from './hooks/useGoogleTasks';
export type { NormalizedTask } from './services/tasksApi';
export type { GoogleTasksCache, TasksSyncStatus } from './services/tasksCache';
