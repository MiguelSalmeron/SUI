/**
 * Cliente mínimo Google Tasks REST.
 *
 * Replica el patrón de `googleApi.ts` — errores tipados para que los handlers
 * respondan 401/429/502 sin adivinar — pero contra la API de Tasks, que tiene
 * su propia base y sus propias rutas.
 *
 * La API de Tasks **no empuja cambios**: no hay webhooks ni push. La única
 * estrategia soportada es polling incremental con `updatedMin`, y por eso
 * `fetchTasks` expone ese parámetro en vez de asumir sincronización completa.
 */

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1';

export class TasksApiError extends Error {
  constructor(
    readonly code: 'reconnect_required' | 'rate_limited' | 'not_found' | 'tasks_error',
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'TasksApiError';
  }
}

const apiFetch = async (
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> => {
  const response = await fetch(`${TASKS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (response.status === 401) {
    throw new TasksApiError('reconnect_required', 401, 'reconnect_required');
  }
  if (response.status === 404) throw new TasksApiError('not_found', 404, 'not_found');
  if (response.status === 429) throw new TasksApiError('rate_limited', 429, 'rate_limited');
  if (response.status === 403) {
    const body = (await response.json().catch(() => ({}))) as { error?: { reason?: string } };
    const reason = body.error?.reason ?? '';
    // Google reporta cuota agotada con 403 + reason `rateLimitExceeded` o
    // `userRateLimitExceeded`, no con 429. Sin esta rama, un rate limit se
    // presentaría como error genérico y la UI pediría reconectar.
    if (
      reason.includes('rateLimit') ||
      reason.includes('quota') ||
      reason.includes('userRateLimit')
    ) {
      throw new TasksApiError('rate_limited', 403, 'rate_limited');
    }
    throw new TasksApiError('tasks_error', 403, 'tasks_error');
  }
  if (!response.ok) throw new TasksApiError('tasks_error', response.status, 'tasks_error');
  return response.json().catch(() => ({}));
};

export const SUI_TASKLIST_TITLE = 'Sui';

type RawTaskList = { id?: string; title?: string; deleted?: boolean };

/**
 * Devuelve el tasklist dedicado de Sui, creándolo si no existe.
 * Mismo criterio que el calendario "Sui": un destino separado, no el @default,
 * para que borrar en Sui nunca toque la lista real de la persona.
 */
export const ensureSuiTaskList = async (accessToken: string): Promise<string> => {
  const list = (await apiFetch(accessToken, '/users/@me/lists?maxResults=100')) as {
    items?: RawTaskList[];
  };
  const existing = (list.items ?? []).find(
    (item) => item.title === SUI_TASKLIST_TITLE && !item.deleted && item.id,
  );
  if (existing?.id) return existing.id;
  const created = (await apiFetch(accessToken, '/users/@me/lists', {
    method: 'POST',
    body: JSON.stringify({ title: SUI_TASKLIST_TITLE }),
  })) as { id?: string };
  if (!created.id) throw new TasksApiError('tasks_error', 502, 'tasklist_create_failed');
  return created.id;
};

export type RawTask = {
  id?: string;
  title?: string;
  notes?: string;
  status?: string;
  completed?: string;
  due?: string;
  deleted?: boolean;
};

export type NormalizedTask = {
  id: string;
  taskListId: string;
  title: string;
  notes?: string;
  /** YYYY-MM-DD; ausente si la tarea no tiene vencimiento. */
  dueDate?: string;
  completed: boolean;
};

/** Normaliza una tarea de la API. `null` si es inservible o fue borrada. */
export const normalizeTask = (taskListId: string, raw: RawTask): NormalizedTask | null => {
  // Las borradas (`deleted`) no se devuelven nunca: Sui no guarda historial de
  // nada externo, y una tarea borrada en Google no puede reinterpretarse.
  if (!raw.id || raw.deleted) return null;
  const dueDate =
    typeof raw.due === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.due)
      ? raw.due.slice(0, 10)
      : undefined;
  return {
    id: raw.id,
    taskListId,
    title: raw.title?.trim() ?? '',
    notes: raw.notes?.trim() || undefined,
    dueDate,
    completed: raw.status === 'completed',
  };
};

/**
 * Tareas del tasklist, paginadas. `updatedMin` habilita el polling
 * incremental: sólo baja lo que cambió desde ese instante.
 */
export const fetchTasks = async (
  accessToken: string,
  taskListId: string,
  options: { updatedMin?: string; showCompleted?: boolean } = {},
): Promise<NormalizedTask[]> => {
  const tasks: NormalizedTask[] = [];
  let pageToken = '';
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      maxResults: '100',
      showCompleted: options.showCompleted ? 'true' : 'false',
      showHidden: 'true',
    });
    if (options.updatedMin) params.set('updatedMin', options.updatedMin);
    if (pageToken) params.set('pageToken', pageToken);
    const body = (await apiFetch(
      accessToken,
      `/users/@me/lists/${encodeURIComponent(taskListId)}/tasks?${params}`,
    )) as { items?: RawTask[]; nextPageToken?: string };
    for (const raw of body.items ?? []) {
      const normalized = normalizeTask(taskListId, raw);
      // `showCompleted` también se filtra acá, y no sólo en el query: Google
      // puede devolver completadas igual y Sui no debe mostrarlas como
      // pendientes.
      if (normalized && (options.showCompleted || !normalized.completed)) {
        tasks.push(normalized);
      }
    }
    pageToken = body.nextPageToken ?? '';
    if (!pageToken) break;
  }
  return tasks;
};

export const createTask = async (
  accessToken: string,
  taskListId: string,
  body: unknown,
): Promise<{ id: string }> => {
  const created = (await apiFetch(
    accessToken,
    `/users/@me/lists/${encodeURIComponent(taskListId)}/tasks`,
    { method: 'POST', body: JSON.stringify(body) },
  )) as { id?: string };
  if (!created.id) throw new TasksApiError('tasks_error', 502, 'task_create_failed');
  return { id: created.id };
};

export const patchTask = async (
  accessToken: string,
  taskListId: string,
  taskId: string,
  body: unknown,
): Promise<void> => {
  await apiFetch(
    accessToken,
    `/users/@me/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
};

export const deleteTask = async (
  accessToken: string,
  taskListId: string,
  taskId: string,
): Promise<void> => {
  try {
    await apiFetch(
      accessToken,
      `/users/@me/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
      { method: 'DELETE' },
    );
  } catch (error) {
    // Borrar algo que ya no existe es el estado deseado, no un fallo.
    if (error instanceof TasksApiError && error.code === 'not_found') return;
    throw error;
  }
};
