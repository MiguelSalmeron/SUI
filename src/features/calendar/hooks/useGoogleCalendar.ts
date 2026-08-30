import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ResponseType } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  clearGoogleEventsCache,
  loadGoogleCalendarCache,
  saveGoogleEventsCache,
  type CalendarSyncStatus,
  type GoogleCalendarCache,
} from '../services/googleSync';
import {
  connectGoogleCalendar,
  disconnectGoogleCalendarConnection,
  getGoogleCalendarConnectionStatus,
  googleCalendarApiConfigured,
  syncGoogleCalendarConnection,
} from '../services/googleConnectionApi';
import type { GoogleEvent } from '@/shared/types/models';
import type { ConnectionProvider, ConnectionStatus } from '@/features/connections/public';
import { recordTelemetry } from '@/shared/observability/telemetry';
import { useI18n } from '@/shared/i18n/i18n';
import type { TranslationKey } from '@/shared/i18n/translations';

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

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

const getCalendarError = (_error: unknown, t: Translate): string => t('connections.errorSync');

/**
 * OAuth independiente para leer Google Calendar.
 * No reutiliza el id_token de Firebase y no persiste el access token.
 */
export const useGoogleCalendar = () => {
  const { t } = useI18n();
  const [cache, setCache] = useState<GoogleCalendarCache>(EMPTY_CACHE);
  const [status, setStatus] = useState<CalendarSyncStatus>('loading-cache');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const inFlightRef = useRef(false);
  const cacheRef = useRef(cache);

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  const configured = Boolean(webClientId) && googleCalendarApiConfigured();
  const effectiveWebId = configured ? webClientId : PLACEHOLDER_CLIENT_ID;

  const [request, , promptAsync] = Google.useAuthRequest({
    clientId: effectiveWebId,
    webClientId: effectiveWebId,
    androidClientId: configured ? androidClientId || effectiveWebId : PLACEHOLDER_CLIENT_ID,
    iosClientId: configured ? iosClientId || effectiveWebId : PLACEHOLDER_CLIENT_ID,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    responseType: ResponseType.Code,
    shouldAutoExchangeCode: false,
    usePKCE: true,
    selectAccount: true,
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });

  useEffect(() => {
    let active = true;
    setStatus('loading-cache');
    loadGoogleCalendarCache()
      .then(async (stored) => {
        if (!active) return;
        setCache(stored);
        setStatus(stored.lastSyncedAt ? 'offline' : 'idle');
        if (!configured) return;
        const remoteConnected = await getGoogleCalendarConnectionStatus();
        if (!active) return;
        setConnected(remoteConnected);
        setStatus(remoteConnected ? (stored.lastSyncedAt ? 'synced' : 'idle') : 'idle');
      })
      .catch(() => {
        if (active) setStatus(cacheRef.current.lastSyncedAt ? 'offline' : 'error');
      });

    return () => {
      active = false;
    };
  }, [configured]);

  const sync = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current || !configured) return false;
    inFlightRef.current = true;
    const startedAt = Date.now();
    setStatus('syncing');
    setError(null);
    try {
      const result = await syncGoogleCalendarConnection();
      await saveGoogleEventsCache(result.events, result.syncedAt);
      setCache({ events: result.events, lastSyncedAt: result.syncedAt });
      setConnected(true);
      setStatus('synced');
      recordTelemetry(
        'connection.completed',
        { provider: 'google_calendar', action: 'sync', result: 'success' },
        Date.now() - startedAt,
      );
      return true;
    } catch (syncError) {
      setError(getCalendarError(syncError, t));
      setStatus(cache.lastSyncedAt ? 'offline' : 'error');
      recordTelemetry(
        'connection.completed',
        { provider: 'google_calendar', action: 'sync', result: 'error' },
        Date.now() - startedAt,
      );
      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [cache.lastSyncedAt, configured, t]);

  const connectAndSync = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current) return false;
    if (!configured) {
      setError(t('connections.errorConfig'));
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
      const authResult = await promptAsync();
      if (cancelled(authResult)) {
        setStatus(cache.lastSyncedAt ? 'offline' : 'idle');
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
      setError(getCalendarError(syncError, t));
      setStatus(cache.lastSyncedAt ? 'offline' : 'error');
      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [cache.lastSyncedAt, configured, promptAsync, request, sync, t]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (configured) await disconnectGoogleCalendarConnection();
    await clearGoogleEventsCache().catch(() => undefined);
    setCache(EMPTY_CACHE);
    setConnected(false);
    setError(null);
    setStatus('idle');
  }, [configured]);

  const clearError = useCallback(() => setError(null), []);

  const platformHint = useMemo(() => {
    if (Platform.OS === 'android' && configured && !androidClientId) {
      return t('connections.androidConfig');
    }
    if (Platform.OS === 'ios' && configured && !iosClientId) {
      return t('connections.iosConfig');
    }
    return null;
  }, [configured, t]);

  const connectionStatus: ConnectionStatus =
    status === 'syncing'
      ? connected
        ? 'syncing'
        : 'connecting'
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
      events: cache.events as GoogleEvent[],
      data: cache.events as GoogleEvent[],
      lastSyncedAt: cache.lastSyncedAt,
      status: connectionStatus,
      syncStatus: status,
      connectionStatus,
      error,
      configured,
      ready: configured && request !== null,
      connected,
      capabilities: { read: true, write: false, backgroundSync: true },
      platformHint,
      connect: connectAndSync,
      connectAndSync,
      sync,
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
      connected,
      connectionStatus,
      platformHint,
      connectAndSync,
      sync,
      disconnect,
      clearError,
    ],
  ) as ConnectionProvider<GoogleEvent[]> & {
    events: GoogleEvent[];
    lastSyncedAt: number | null;
    ready: boolean;
    error: string | null;
    platformHint: string | null;
    connectAndSync: () => Promise<boolean>;
    clearError: () => void;
    connectionStatus: ConnectionStatus;
    syncStatus: CalendarSyncStatus;
  };
};
