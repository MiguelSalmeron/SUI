import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCalendars } from 'expo-localization';
import {
  DEFAULT_MIRROR_PREFS,
  localDateKey,
  shouldMirrorGoal,
  shouldMirrorHabit,
} from '@/shared/domain/productivity/pure';
import type { MirrorPreferences } from '@sui/contracts';
import type { Goal, Habit } from '@/shared/types/models';
import { recordTelemetry } from '@/shared/observability/telemetry';
import {
  ConnectionApiError,
  getGoogleCalendarConnectionStatus,
  googleCalendarApiConfigured,
  mirrorDelete,
  mirrorUpsert,
} from './googleConnectionApi';

const MIRROR_QUEUE_KEY = '@sui/mirror-queue-v1';

export interface MirrorJob {
  suiId: string;
  suiType: 'goal' | 'habit';
  operation: 'upsert' | 'delete';
}

const deviceTimeZone = (): string | undefined => {
  try {
    return getCalendars()[0]?.timeZone ?? undefined;
  } catch {
    return undefined;
  }
};

const loadQueue = async (): Promise<MirrorJob[]> => {
  try {
    const raw = await AsyncStorage.getItem(MIRROR_QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (job): job is MirrorJob =>
        Boolean(job) &&
        typeof job === 'object' &&
        typeof (job as MirrorJob).suiId === 'string' &&
        ((job as MirrorJob).suiType === 'goal' || (job as MirrorJob).suiType === 'habit'),
    );
  } catch {
    return [];
  }
};

const saveQueue = async (jobs: MirrorJob[]): Promise<void> => {
  await AsyncStorage.setItem(MIRROR_QUEUE_KEY, JSON.stringify(jobs));
};

/** Encola un espejo (deduplica por suiId, delete gana sobre upsert). */
export const enqueueMirror = async (job: MirrorJob): Promise<void> => {
  const queue = (await loadQueue()).filter((item) => item.suiId !== job.suiId);
  queue.push(job);
  await saveQueue(queue);
};

/** Tamaño actual de la cola (para mostrar estado en UI). */
export const getMirrorQueueLength = async (): Promise<number> => (await loadQueue()).length;

/** Candidatos actuales según reglas + prefs de Settings. */
export const collectMirrorCandidates = (
  goals: Goal[],
  habits: Habit[],
  prefs: MirrorPreferences = DEFAULT_MIRROR_PREFS,
): MirrorJob[] => [
  ...goals
    .filter((goal) => shouldMirrorGoal(goal, prefs))
    .map((goal): MirrorJob => ({
      suiId: goal.id,
      suiType: 'goal',
      operation: 'upsert',
    })),
  ...habits
    .filter((habit) => shouldMirrorHabit(habit, prefs))
    .map((habit): MirrorJob => ({
      suiId: habit.id,
      suiType: 'habit',
      operation: 'upsert',
    })),
];

/**
 * Elimina jobs encolados que ya no aplican (ej. categoría apagada en Settings).
 * Los deletes nunca se podan: borrar en Sui siempre debe borrar en Google.
 */
export const pruneMirrorQueue = async (
  predicate: (job: MirrorJob) => boolean,
): Promise<void> => {
  await saveQueue((await loadQueue()).filter((job) => !predicate(job)));
};

let flushInFlight = false;

/**
 * Procesa la cola secuencialmente. Seguro en web y app: sin sockets,
 * sin background tasks, reintenta en la próxima apertura si falla.
 * Devuelve true si la cola quedó vacía.
 */
export const flushMirrorQueue = async (): Promise<boolean> => {
  if (flushInFlight || !googleCalendarApiConfigured()) return false;
  flushInFlight = true;
  const startedAt = Date.now();
  try {
    let connected = false;
    try {
      connected = await getGoogleCalendarConnectionStatus();
    } catch {
      return false;
    }
    if (!connected) return false;

    let queue = await loadQueue();
    const timeZone = deviceTimeZone();
    const startDate = localDateKey();
    while (queue.length > 0) {
      const [job, ...rest] = queue;
      try {
        if (job.operation === 'delete') {
          await mirrorDelete(job.suiId);
        } else {
          await mirrorUpsert({ suiId: job.suiId, suiType: job.suiType, startDate, timeZone });
        }
        queue = rest;
        await saveQueue(queue);
      } catch (error) {
        if (error instanceof ConnectionApiError && error.status === 429) {
          await saveQueue(queue);
          recordTelemetry('mirror.completed', { result: 'rate_limited' }, Date.now() - startedAt);
          return false;
        }
        if (error instanceof ConnectionApiError && error.status === 401) {
          await saveQueue(queue);
          recordTelemetry('mirror.completed', { result: 'reauth' }, Date.now() - startedAt);
          return false;
        }
        // Error puntual (400 mirror_disabled, 502): descarta el job para no bloquear la cola.
        queue = rest;
        await saveQueue(queue);
        recordTelemetry('mirror.completed', { result: 'skipped' }, Date.now() - startedAt);
      }
    }
    recordTelemetry('mirror.completed', { result: 'success' }, Date.now() - startedAt);
    return true;
  } finally {
    flushInFlight = false;
  }
};
