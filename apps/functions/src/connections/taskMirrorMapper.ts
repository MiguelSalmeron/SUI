/**
 * Mapeo de entidades Sui → Google Tasks.
 *
 * Vive en el backend porque el backend es el único writer: lee la entidad desde
 * Firestore (fuente de verdad) y escribe en Tasks. El cliente nunca manda el
 * título ni la fecha, igual que en el espejo de Calendar.
 *
 * A diferencia de Calendar, Tasks no exige fecha ni horario: un item sin fecha
 * igual es una tarea válida. Eso es justo lo que aporta este conector — con
 * Calendar, una meta sin fecha nunca aparecía fuera de Sui.
 *
 * Regla: **Sui manda, Tasks recibe.** No hay import inverso en esta fase, para
 * que el espejo no pueda generar ciclos.
 */

const isDateKey = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

export type MirrorSource = {
  suiType: 'goal' | 'habit';
  suiId: string;
  title: string;
  /** YYYY-MM-DD; ausente si la entidad no tiene fecha. */
  dueDate?: string;
  completed: boolean;
  gravity?: 'high' | 'low';
};

export type GoogleTaskBody = {
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
};

/**
 * Cuerpo de la tarea. `null` cuando no hay título: el llamador decide entre
 * borrar y dejar de escribir, nunca inventa un título.
 */
export const toGoogleTaskBody = (source: MirrorSource): GoogleTaskBody | null => {
  const title = source.title.trim();
  if (!title) return null;

  const body: GoogleTaskBody = {
    title,
    notes: `Sui · ${source.suiType === 'goal' ? 'meta' : 'hábito'}`,
    status: source.completed ? 'completed' : 'needsAction',
  };

  // Sólo se manda `due` si hay fecha real: Google rechaza formats inválidos y
  // una fecha inventada pondría la tarea en el día equivocado.
  if (isDateKey(source.dueDate)) body.due = source.dueDate;

  return body;
};

/** Huella estable para idempotencia: si nada cambió, no se reescribe. */
export const fingerprintTaskBody = (body: GoogleTaskBody): string =>
  [body.title, body.status, body.due ?? '', body.notes ?? ''].join('|');

/** Convierte una entidad Sui leída de Firestore en fuente de espejo. */
export const toMirrorSource = (
  suiType: 'goal' | 'habit',
  suiId: string,
  entity: Record<string, unknown>,
): MirrorSource | null => {
  if (typeof entity.title !== 'string') return null;
  return {
    suiType,
    suiId,
    title: entity.title,
    dueDate: isDateKey(entity.deadline) ? entity.deadline : undefined,
    completed: entity.completed === true,
    gravity: entity.gravity === 'high' ? 'high' : 'low',
  };
};
