import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ResponseType } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  clearGoogleEventsCache,
  loadGoogleCalendarCache,
  syncGoogleCalendar,
  type CalendarSyncStatus,
  type GoogleCalendarCache,
  GoogleCalendarError,
} from '../services/googleSync';
import type { GoogleEvent } from '@/shared/types/models';

WebBrowser.maybeCompleteAuthSession();

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || undefined;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined;
const PLACEHOLDER_CLIENT_ID = 'missing.apps.googleusercontent.com';

const EMPTY_CACHE: GoogleCalendarCache = {
  events: [],
  lastSyncedAt: null,
};

const cancelled = (result: { type: string }): boolean =>
  result.type === 'cancel' || result.type === 'dismiss';

const getAccessToken = (result: {
  type: string;
  authentication?: { accessToken?: string | null } | null;
  params?: { access_token?: string };
}): string =>
  result.authentication?.accessToken?.trim() || result.params?.access_token?.trim() || '';

const getCalendarError = (error: unknown): string => {
  if (error instanceof GoogleCalendarError) return error.message;
  return error instanceof Error
    ? error.message
    : 'No se pudo sincronizar Google Calendar.';
};

/**
 * OAuth independiente para leer Google Calendar.
 * No reutiliza el id_token de Firebase y no persiste el access token.
 */
export const useGoogleCalendar = () => {
  const [cache, setCache] = useState<GoogleCalendarCache>(EMPTY_CACHE);
  const [status, setStatus] = useState<CalendarSyncStatus>('loading-cache');
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const configured = Boolean(webClientId);
  const effectiveWebId = configured ? webClientId : PLACEHOLDER_CLIENT_ID;

  const [request, , promptAsync] = Google.useAuthRequest({
    clientId: effectiveWebId,
    webClientId: effectiveWebId,
    androidClientId: configured ? androidClientId || effectiveWebId : PLACEHOLDER_CLIENT_ID,
    iosClientId: configured ? iosClientId || effectiveWebId : PLACEHOLDER_CLIENT_ID,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    responseType: ResponseType.Token,
    selectAccount: true,
  });

  useEffect(() => {
    let active = true;
    setStatus('loading-cache');
    loadGoogleCalendarCache()
      .then((stored) => {
        if (!active) return;
        setCache(stored);
        setStatus(stored.lastSyncedAt ? 'offline' : 'idle');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, []);

  const connectAndSync = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current) return false;
    if (!configured) {
      setError('Google no está configurado. Añade el Client ID Web en las variables de entorno.');
      setStatus('error');
      return false;
    }
    if (!request) {
      setError('Google Calendar aún se está preparando. Inténtalo de nuevo en un momento.');
      setStatus('error');
      return false;
    }

    inFlightRef.current = true;
    setStatus('syncing');
    setError(null);

    try {
      const authResult = await promptAsync();
      if (cancelled(authResult)) {
        setStatus(cache.lastSyncedAt ? 'offline' : 'idle');
        return false;
      }
      if (authResult.type !== 'success') {
        setError('No se concedió acceso a Google Calendar.');
        setStatus('error');
        return false;
      }

      const accessToken = getAccessToken(authResult);
      if (!accessToken) {
        setError('Google no devolvió un token de Calendar.');
        setStatus('error');
        return false;
      }

      const nextCache = await syncGoogleCalendar(accessToken);
      setCache(nextCache);
      setStatus('synced');
      return true;
    } catch (syncError) {
      setError(getCalendarError(syncError));
      setStatus(cache.lastSyncedAt ? 'offline' : 'error');
      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [cache.lastSyncedAt, configured, promptAsync, request]);

  const disconnect = useCallback(async (): Promise<void> => {
    await clearGoogleEventsCache().catch(() => undefined);
    setCache(EMPTY_CACHE);
    setError(null);
    setStatus('idle');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const platformHint = useMemo(() => {
    if (Platform.OS === 'android' && configured && !androidClientId) {
      return 'En Android conviene configurar el Client ID Android y su SHA-1.';
    }
    if (Platform.OS === 'ios' && configured && !iosClientId) {
      return 'En iOS conviene configurar el Client ID iOS.';
    }
    return null;
  }, [configured]);

  return useMemo(
    () => ({
      events: cache.events as GoogleEvent[],
      lastSyncedAt: cache.lastSyncedAt,
      status,
      error,
      configured,
      ready: configured && request !== null,
      connected: cache.lastSyncedAt !== null,
      platformHint,
      connectAndSync,
      disconnect,
      clearError,
    }),
    [
      cache.events,
      cache.lastSyncedAt,
      status,
      error,
      configured,
      request,
      platformHint,
      connectAndSync,
      disconnect,
      clearError,
    ],
  );
};
