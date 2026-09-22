import { ConnectionApiError } from './googleConnectionApi';
import type { TranslationKey } from '@/shared/i18n/translations';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

/**
 * Redirect reverso del cliente Android nativo: Google solo acepta
 * `com.googleusercontent.apps.<prefijo>:/oauth2redirect` (el esquema de la
 * app da 400 invalid_request). Debe coincidir con el intent-filter declarado
 * en `app.json` → `android.intentFilters`. Login y Calendar comparten este
 * criterio (ver `useGoogleAuth`).
 */
export const androidReverseRedirectUri = (
  platform: string,
  webClientId: string | undefined,
  androidClientId: string | undefined,
): string | undefined => {
  if (platform !== 'android' || !webClientId || !androidClientId) return undefined;
  return `com.googleusercontent.apps.${androidClientId.split('.')[0]}:/oauth2redirect`;
};

/**
 * Params extra de la autorización de Calendar.
 *
 * `prompt: 'consent select_account'` va explícito porque `selectAccount: true`
 * de expo-auth-session SOBREESCRIBE `extraParams.prompt` (el provider asigna
 * `prompt = 'select_account'` después de hacer spread de extraParams), lo que
 * eliminaría `consent` y con él la garantía de `refresh_token` en la
 * re-conexión. Google acepta múltiples valores de prompt separados por espacio.
 */
export const calendarPromptParams = (): Record<string, string> => ({
  access_type: 'offline',
  prompt: 'consent select_account',
});

/** Motivo estable para telemetría, sin exponer mensajes del servidor. */
export const connectionErrorReason = (error: unknown): string => {
  if (error instanceof ConnectionApiError) return `http_${error.status}`;
  if (error instanceof TypeError) return 'network';
  return 'unknown';
};

/**
 * Traduce el fallo real a un mensaje accionable. Antes se devolvía siempre el
 * genérico `errorSync`, lo que ocultaba causas como un 400 por OAuth mal
 * configurado en el entorno.
 */
export const translateConnectionError = (error: unknown, t: Translate): string => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[Google Calendar] connection failed:', error);
  }
  if (error instanceof ConnectionApiError) {
    if (error.status === 400) return t('connections.errorConnectConfig');
    if (error.status === 403) return t('connections.errorPermission');
    if (error.status === 429) return t('connections.errorRateLimited');
    if (error.status === 503) return t('connections.errorConfig');
    if (error.status >= 500) return t('connections.errorGoogle');
  }
  if (error instanceof TypeError) return t('connections.errorNetwork');
  return t('connections.errorSync');
};
