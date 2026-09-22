/**
 * Decide el calendario destino del espejo Sui → Google (Fase 3).
 *
 * El scope `calendar.events` permite crear/editar eventos en TODOS los
 * calendarios del usuario (incluido `primary`), pero NO listar el
 * calendarList ni crear calendarios secundarios (eso requiere
 * `calendar.calendars` / `calendar.calendarlist` / `calendar.app.created`,
 * scopes restringidos que exigen verificación de Google).
 *
 * Estrategia: si la conexión sólo tiene `calendar.events`, el espejo escribe
 * en el calendario primario. Si algún día se conceden scopes de creación,
 * se intenta el calendario dedicado "Sui" con fallback silencioso a primary.
 */

export const PRIMARY_CALENDAR_ID = 'primary';

const SECONDARY_ALLOWED_SCOPES = new Set([
  'https://www.googleapis.com/auth/calendar.app.created',
  'https://www.googleapis.com/auth/calendar.calendars',
  'https://www.googleapis.com/auth/calendar',
]);

export const canCreateSecondaryCalendars = (scope: string | undefined): boolean =>
  (scope ?? '')
    .split(' ')
    .some((item) => SECONDARY_ALLOWED_SCOPES.has(item.trim()));

export const resolveMirrorCalendarId = async (
  accessToken: string,
  scope: string | undefined,
  ensureSuiCalendar: (token: string) => Promise<string>,
): Promise<string> => {
  if (!canCreateSecondaryCalendars(scope)) return PRIMARY_CALENDAR_ID;
  try {
    return await ensureSuiCalendar(accessToken);
  } catch {
    // 403/404/cualquier fallo del calendario dedicado no debe romper el espejo.
    return PRIMARY_CALENDAR_ID;
  }
};
