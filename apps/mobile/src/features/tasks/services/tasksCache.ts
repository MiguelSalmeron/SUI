import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NormalizedTask } from './tasksApi';

/**
 * Caché local de Google Tasks. Misma disciplina que la de Calendar: guarda
 * tareas **normalizadas**, nunca tokens, y descarta la caché si pertenece a
 * otra cuenta. El token de Tasks vive sólo en el backend.
 */

const TASKS_CACHE_KEY = '@sui/google-tasks-v1';

export type TasksSyncStatus =
  | 'idle'
  | 'loading-cache'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'reauthRequired'
  | 'error';

export interface GoogleTasksCache {
  tasks: NormalizedTask[];
  lastSyncedAt: number | null;
  /** uid dueño de la caché; evita mostrar tareas de otra cuenta. */
  ownerUid?: string;
}

const EMPTY_CACHE: GoogleTasksCache = {
  tasks: [],
  lastSyncedAt: null,
};

const isNormalizedTask = (value: unknown): value is NormalizedTask => {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<NormalizedTask>;
  return (
    typeof task.id === 'string' &&
    typeof task.taskListId === 'string' &&
    typeof task.title === 'string' &&
    typeof task.completed === 'boolean'
  );
};

const parseCache = (raw: string | null): GoogleTasksCache => {
  if (!raw) return EMPTY_CACHE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY_CACHE;
    const value = parsed as { tasks?: unknown; lastSyncedAt?: unknown; ownerUid?: unknown };
    // Sin ownerUid no se puede atribuir la caché: se descarta antes que
    // mostrar tareas de otra cuenta.
    if (typeof value.ownerUid !== 'string' || !value.ownerUid) return EMPTY_CACHE;
    const tasks = Array.isArray(value.tasks) ? value.tasks.filter(isNormalizedTask) : [];
    const lastSyncedAt =
      typeof value.lastSyncedAt === 'number' && Number.isFinite(value.lastSyncedAt)
        ? value.lastSyncedAt
        : null;
    return { tasks, lastSyncedAt, ownerUid: value.ownerUid };
  } catch {
    return EMPTY_CACHE;
  }
};

/** Descarta la caché si es de otra cuenta. `currentUid` vacío no descarta. */
export const resolveLoadedTasksCache = (
  stored: GoogleTasksCache,
  currentUid: string,
): GoogleTasksCache => {
  if (!currentUid) return stored;
  return stored.ownerUid === currentUid ? stored : EMPTY_CACHE;
};

export const loadGoogleTasksCache = async (): Promise<GoogleTasksCache> => {
  try {
    return parseCache(await AsyncStorage.getItem(TASKS_CACHE_KEY));
  } catch {
    return EMPTY_CACHE;
  }
};

export const saveGoogleTasksCache = async (
  tasks: NormalizedTask[],
  lastSyncedAt: number = Date.now(),
  ownerUid?: string,
): Promise<void> => {
  const cache: GoogleTasksCache = { tasks, lastSyncedAt, ownerUid };
  await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(cache));
};

export const clearGoogleTasksCache = async (): Promise<void> => {
  await AsyncStorage.removeItem(TASKS_CACHE_KEY);
};
