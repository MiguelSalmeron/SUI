import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ResponseType } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  clearGoogleEventsCache,
  GOOGLE_CALENDAR_WRITE_SCOPE,
  loadGoogleCalendarCache,
  resolveLoadedCache,
  saveGoogleEventsCache,
  type CalendarSyncStatus,
  type GoogleCalendarCache,
} from '../services/googleSync';
import {
  ConnectionApiError,
  connectGoogleCalendar,
  disconnectGoogleCalendarConnection,
  getGoogleCalendarConnectionStatus,
  googleCalendarApiConfigured,
  syncGoogleCalendarConnection,
} from '../services/googleConnectionApi';
import type { GoogleEvent } from '@/shared/types/models';
import type { ConnectionProvider, ConnectionStatus } from '@/features/connections/public';
import { recordTelemetry } from '@/shared/observability/telemetry';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import { useI18n } from '@/shared/i18n/i18n';
import {
  androidReverseRedirectUri,
  calendarPromptParams,
  connectionErrorReason as errorReason,
  translateConnectionError as getCalendarError,
} from '../services/calendarAuth';

WebBrowser.maybeCompleteAuthSession();

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || undefined;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined;
const PLACEHOLDER_CLIENT_ID = 'missing.apps.googleusercontent.com';

const androidRedirectUri = androidReverseRedirectUri(Platform.OS, webClientId, androidClientId);

const EMPTY_CACHE: GoogleCalendarCache = {
  events: [],
  lastSyncedAt: null,
};

const cancelled = (result: { type: string }): boolean =>
  result.type === 'cancel' || result.type === 'dismiss';

const isAuthError = (error: unknown): boolean => {
  if (error instanceof ConnectionApiError && error.status === 401) return true;
  if (error && typeof error === 'object') {
    const status = (error as { status?: unknown }).status;
    if (status === 401) return true;
    const message = (error as { message?: unknown }).message;
    if (
      typeof message === 'string' &&
      (message.includes('401') ||
        message.includes('reconnect_required') ||
        message.includes('not_connected') ||
        message.includes('invalid_grant'))
    ) {
      return true;
    }
  }
  return false;
};

/**
 * OAuth independiente para leer Google Calendar.
 * No reutiliza el id_token de Firebase y no persiste el access token.
 *
 * Devuelve el contrato `ConnectionProvider` completo, sin cast: todo lo que la
 * tarjeta genérica necesita (último sync, error, aviso de plataforma) está
 * declarado en el contrato.
 */
export const useGoogleCalendar = (): ConnectionProvider<GoogleEvent[]> => {
  const { t } = useI18n();
  const [cache, setCache] = useState<GoogleCalendarCache>(EMPTY_CACHE);
  const [status, setStatus] = useState<CalendarSyncStatus>('loading-cache');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const inFlightRef = useRef(false);
  const cacheRef = useRef(cache);
  const syncRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  const configured = Boolean(webClientId) && googleCalendarApiConfigured();
  const effectiveWebId = configured ? webClientId : PLACEHOLDER_CLIENT_ID;

  const [request, , promptAsync] = Google.useAuthRequest({
    clientId: effectiveWebId,
    redirectUri: androidRedirectUri,
    webClientId: effectiveWebId,
    androidClientId: configured ? androidClientId || effectiveWebId : PLACEHOLDER_CLIENT_ID,
    iosClientId: configured ? iosClientId || effectiveWebId : PLACEHOLDER_CLIENT_ID,
    scopes: [GOOGLE_CALENDAR_WRITE_SCOPE],
    responseType: ResponseType.Code,
    shouldAutoExchangeCode: false,
    usePKCE: true,
    selectAccount: false,
    extraParams: calendarPromptParams(),
  });

  const sync = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current || !configured) return false;
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.isAnonymous) {
      return false;
    }
    inFlightRef.current = true;
    const startedAt = Date.now();
    setStatus('syncing');
    setError(null);
    try {
      const result = await syncGoogleCalendarConnection();
      await saveGoogleEventsCache(result.events, result.syncedAt, currentUser.uid);
      setCache({ events: result.events, lastSyncedAt: result.syncedAt, ownerUid: currentUser.uid });
      setConnected(true);
      setStatus('synced');
      recordTelemetry(
        'connection.completed',
        { provider: 'google_calendar', action: 'sync', result: 'success' },
        Date.now() - startedAt,
      );
      return true;
    } catch (syncError) {
      if (isAuthError(syncError)) {
        setConnected(false);
        setStatus('reauthRequired');
        setError(t('connections.reauthRequired'));
      } else {
        setError(getCalendarError(syncError, t));
        setStatus(cacheRef.current.lastSyncedAt ? 'offline' : 'error');
      }
      recordTelemetry(
        'connection.completed',
        {
          provider: 'google_calendar',
          action: 'sync',
          result: 'error',
          reason: errorReason(syncError),
        },
        Date.now() - startedAt,
      );
      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [configured, t]);

  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  useEffect(() => {
    let active = true;
    setStatus('loading-cache');
    loadGoogleCalendarCache()
      .then(async (stored) => {
        if (!active) return;
        const currentUser = auth.currentUser;
        const cache = resolveLoadedCache(
          stored,
          currentUser && !currentUser.isAnonymous ? currentUser.uid : '',
        );
        setCache(cache);
        setStatus(cache.lastSyncedAt ? 'offline' : 'idle');
        if (!configured) return;
        if (!currentUser || currentUser.isAnonymous) {
          setConnected(false);
          setStatus(cache.lastSyncedAt ? 'offline' : 'idle');
          return;
        }
        let remoteConnected = false;
        try {
          remoteConnected = await getGoogleCalendarConnectionStatus();
        } catch (statusError) {
          if (!active) return;
          if (isAuthError(statusError)) {
            setConnected(false);
            setStatus('reauthRequired');
            setError(t('connections.reauthRequired'));
            return;
          }
          setStatus(cache.lastSyncedAt ? 'offline' : 'error');
          return;
        }
        if (!active) return;
        setConnected(remoteConnected);
        if (remoteConnected) {
          void syncRef.current();
        } else {
          setStatus(cache.lastSyncedAt ? 'offline' : 'idle');
        }
      })
      .catch((err) => {
        if (active) {
          if (isAuthError(err)) {
            setConnected(false);
            setStatus('reauthRequired');
            setError(t('connections.reauthRequired'));
          } else {
            setStatus(cacheRef.current.lastSyncedAt ? 'offline' : 'error');
          }
        }
      });

    return () => {
      active = false;
    };
  }, [configured, t]);

  const connectAndSync = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current) return false;
    if (!configured) {
      setError(t('connections.errorConfig'));
      setStatus('error');
      return false;
    }
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.isAnonymous) {
      setError(t('connections.errorDenied'));
      setStatus('error');
      return false;
    }
    if (!request) {
      setError(t('connections.errorPreparing'));
      setStatus('error');
      return false;
    }

    inFlightRef.current = true;
    setStatus('syncing');
    setError(null);

    try {
      if (__DEV__) {
        console.log('[Google Calendar] Starting auth flow with:', {
          clientId: request.clientId,
          redirectUri: request.redirectUri,
          platform: Platform.OS,
        });
      }
      const authResult = await promptAsync();
      if (cancelled(authResult)) {
        setStatus(cacheRef.current.lastSyncedAt ? 'offline' : 'idle');
        return false;
      }
      if (authResult.type !== 'success') {
        setError(t('connections.errorDenied'));
        setStatus('error');
        return false;
      }

      const code = authResult.params.code?.trim() ?? '';
      const codeVerifier = request.codeVerifier?.trim() ?? '';
      if (!code || !codeVerifier) {
        setError(t('connections.errorCode'));
        setStatus('error');
        return false;
      }

      await connectGoogleCalendar({
        code,
        codeVerifier,
        redirectUri: request.redirectUri,
        clientId: request.clientId,
      });
      setConnected(true);
      inFlightRef.current = false;
      return sync();
    } catch (syncError) {
      if (isAuthError(syncError)) {
        setConnected(false);
        setStatus('reauthRequired');
        setError(t('connections.reauthRequired'));
      } else {
        setError(getCalendarError(syncError, t));
        setStatus(cacheRef.current.lastSyncedAt ? 'offline' : 'error');
      }
      recordTelemetry('connection.completed', {
        provider: 'google_calendar',
        action: 'connect',
        result: 'error',
        reason: errorReason(syncError),
      });
      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [configured, promptAsync, request, sync, t]);

  const disconnect = useCallback(async (): Promise<void> => {
    // Best-effort: un fallo de red no debe dejar la caché local viva ni la UI
    // en estado "conectado fantasma".
    if (configured) {
      await disconnectGoogleCalendarConnection().catch(() => undefined);
    }
    await clearGoogleEventsCache().catch(() => undefined);
    setCache(EMPTY_CACHE);
    setConnected(false);
    setError(null);
    setStatus('idle');
  }, [configured]);

  const clearError = useCallback(() => setError(null), []);

  const platformHint = useMemo(() => {
    if (Platform?.OS === 'android' && configured && !androidClientId) {
      return t('connections.androidConfig');
    }
    if (Platform?.OS === 'ios' && configured && !iosClientId) {
      return t('connections.iosConfig');
    }
    return null;
  }, [configured, t]);

  const connectionStatus: ConnectionStatus =
    status === 'syncing'
      ? connected
        ? 'syncing'
        : 'connecting'
      : status === 'reauthRequired'
        ? 'reauthRequired'
        : status === 'error'
          ? 'error'
          : status === 'offline'
            ? 'offline'
            : connected
              ? 'connected'
              : 'disconnected';

  return useMemo(
    () => ({
      id: 'google-calendar',
      labelKey: 'connections.googleCalendar',
      status: connectionStatus,
      connected,
      configured,
      // El espejo escribe eventos con `calendar.events`, así que `write` va en
      // true. Antes decía false, que contradecía el comportamiento real.
      capabilities: { read: true, write: true, backgroundSync: true },
      data: cache.events,
      lastSyncedAt: cache.lastSyncedAt,
      error,
      platformHint,
      connect: connectAndSync,
      sync,
      disconnect,
      clearError,
    }),
    [
      cache.events,
      cache.lastSyncedAt,
      error,
      connected,
      configured,
      connectionStatus,
      platformHint,
      connectAndSync,
      sync,
      disconnect,
      clearError,
    ],
  );
};
