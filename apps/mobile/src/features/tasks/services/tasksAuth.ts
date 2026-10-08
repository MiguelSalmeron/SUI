import { ConnectionApiError } from './tasksApi';
import type { TranslationKey } from '@/shared/i18n/translations';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

/**
 * Params extra de la autorización de Tasks.
 *
 * `access_type: 'offline'` es obligatorio para que Google devuelva refresh
 * token; sin él la conexión muere a la hora. `prompt: 'consent select_account'`
 * va explícito por la misma razón que en Calendar: `selectAccount: true` de
 * expo-auth-session sobreescribe `extraParams.prompt`, y se quedaría sin
 * `consent`, que es lo que garantiza el refresh token al reconectar.
 */
export const tasksPromptParams = (): Record<string, string> => ({
  access_type: 'offline',
  prompt: 'consent select_account',
});

/** Traduce el fallo real a un mensaje accionable, por status HTTP. */
export const translateTasksError = (error: unknown, t: Translate): string => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[Google Tasks] connection failed:', error);
  }
  if (error instanceof ConnectionApiError) {
    if (error.status === 400) return t('tasks.errorConnectConfig');
    if (error.status === 403) return t('tasks.errorPermission');
    if (error.status === 429) return t('tasks.errorRateLimited');
    if (error.status === 503) return t('tasks.errorConfig');
    if (error.status >= 500) return t('tasks.errorGoogle');
  }
  if (error instanceof TypeError) return t('tasks.errorNetwork');
  return t('tasks.errorSync');
};
