import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ResponseType } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import { recordTelemetry } from '@/shared/observability/telemetry';
import { useI18n } from '@/shared/i18n/i18n';
import { androidReverseRedirectUri } from '@/features/calendar/public';
import type { ConnectionProvider, ConnectionStatus } from '@/features/connections/public';
import {
  clearGoogleTasksCache,
  loadGoogleTasksCache,
  resolveLoadedTasksCache,
  saveGoogleTasksCache,
  type GoogleTasksCache,
  type TasksSyncStatus,
} from '../services/tasksCache';
import {
  ConnectionApiError,
  connectGoogleTasks,
  disconnectGoogleTasksConnection,
  getGoogleTasksConnectionStatus,
  googleTasksApiConfigured,
  syncGoogleTasksConnection,
  type NormalizedTask,
} from '../services/tasksApi';
import { tasksPromptParams, translateTasksError } from '../services/tasksAuth';

WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || undefined;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined;
const PLACEHOLDER_CLIENT_ID = 'missing.apps.googleusercontent.com';

const androidRedirectUri = androidReverseRedirectUri(
  Platform.OS,
  webClientId,
  androidClientId,
);

const EMPTY_CACHE: GoogleTasksCache = { tasks: [], lastSyncedAt: null };

const cancelled = (result: { type: string }): boolean =>
  result.type === 'cancel' || result.type === 'dismiss';

/** 401 en cualquier capa significa que hay que volver a autorizar. */
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
 * OAuth independiente para Google Tasks.
 *
 * No reutiliza la sesión de Firebase ni la de Calendar: son consentimientos
 * distintos y `ADR-0006` los mantiene separados. Tampoco persiste el access
 * token en el cliente — el refresh vive en el backend.
 */
export const useGoogleTasks = (): ConnectionProvider<NormalizedTask[]> => {
  const { t } = useI18n();
  const [cache, setCache] = useState<GoogleTasksCache>(EMPTY_CACHE);
  const [status, setStatus] = useState<TasksSyncStatus>('loading-cache');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const inFlightRef = useRef(false);
  const cacheRef = useRef(cache);
  const syncRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  const configured = Boolean(webClientId) && googleTasksApiConfigured();
  const effectiveWebId = configured ? webClientId : PLACEHOLDER_CLIENT_ID;

  const [request, , promptAsync] = Google.useAuthRequest({
    clientId: effectiveWebId,
    redirectUri: androidRedirectUri,
    webClientId: effectiveWebId,
    androidClientId: configured ? androidClientId || effectiveWebId : PLACEHOLDER_CLIENT_ID,
    iosClientId: configured ? iosClientId || effectiveWebId : PLACEHOLDER_CLIENT_ID,
    scopes: [GOOGLE_TASKS_SCOPE],
    responseType: ResponseType.Code,
    shouldAutoExchangeCode: false,
    usePKCE: true,
    selectAccount: false,
    extraParams: tasksPromptParams(),
  });

  const sync = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current || !configured) return false;
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.isAnonymous) return false;
    inFlightRef.current = true;
    const startedAt = Date.now();
    setStatus('syncing');
    setError(null);
    try {
      const result = await syncGoogleTasksConnection();
      await saveGoogleTasksCache(result.tasks, result.syncedAt, currentUser.uid);
      setCache({ tasks: result.tasks, lastSyncedAt: result.syncedAt, ownerUid: currentUser.uid });
      setConnected(true);
      setStatus('synced');
      recordTelemetry(
        'connection.completed',
        { provider: 'google_tasks', action: 'sync', result: 'success' },
        Date.now() - startedAt,
      );
      return true;
    } catch (syncError) {
      if (isAuthError(syncError)) {
        setConnected(false);
        setStatus('reauthRequired');
        setError(t('tasks.reauthRequired'));
      } else {
        setError(translateTasksError(syncError, t));
        setStatus(cacheRef.current.lastSyncedAt ? 'offline' : 'error');
      }
      recordTelemetry(
        'connection.completed',
        {
          provider: 'google_tasks',
          action: 'sync',
          result: 'error',
          reason: syncError instanceof ConnectionApiError ? `http_${syncError.status}` : 'unknown',
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
    loadGoogleTasksCache()
      .then(async (stored) => {
        if (!active) return;
        const currentUser = auth.currentUser;
        const resolved = resolveLoadedTasksCache(
          stored,
          currentUser && !currentUser.isAnonymous ? currentUser.uid : '',
        );
        setCache(resolved);
        setStatus(resolved.lastSyncedAt ? 'offline' : 'idle');
        if (!configured) return;
        if (!currentUser || currentUser.isAnonymous) {
          setConnected(false);
          return;
        }
        let remoteConnected = false;
        try {
          remoteConnected = await getGoogleTasksConnectionStatus();
        } catch (statusError) {
          if (!active) return;
          if (isAuthError(statusError)) {
            setConnected(false);
            setStatus('reauthRequired');
            setError(t('tasks.reauthRequired'));
            return;
          }
          setStatus(resolved.lastSyncedAt ? 'offline' : 'error');
          return;
        }
        if (!active) return;
        setConnected(remoteConnected);
        if (remoteConnected) void syncRef.current();
      })
      .catch((err) => {
        if (!active) return;
        if (isAuthError(err)) {
          setConnected(false);
          setStatus('reauthRequired');
          setError(t('tasks.reauthRequired'));
        } else {
          setStatus(cacheRef.current.lastSyncedAt ? 'offline' : 'error');
        }
      });

    return () => {
      active = false;
    };
  }, [configured, t]);

  const connect = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current) return false;
    if (!configured) {
      setError(t('tasks.errorConfig'));
      setStatus('error');
      return false;
    }
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.isAnonymous) {
      setError(t('tasks.errorDenied'));
      setStatus('error');
      return false;
    }
    if (!request) {
      setError(t('tasks.errorPreparing'));
      setStatus('error');
      return false;
    }

    inFlightRef.current = true;
    setStatus('syncing');
    setError(null);

    try {
      const authResult = await promptAsync();
      if (cancelled(authResult)) {
        setStatus(cacheRef.current.lastSyncedAt ? 'offline' : 'idle');
        return false;
      }
      if (authResult.type !== 'success') {
        setError(t('tasks.errorDenied'));
        setStatus('error');
        return false;
      }
      const code = authResult.params.code?.trim() ?? '';
      const codeVerifier = request.codeVerifier?.trim() ?? '';
      if (!code || !codeVerifier) {
        setError(t('tasks.errorCode'));
        setStatus('error');
        return false;
      }
      await connectGoogleTasks({
        code,
        codeVerifier,
        redirectUri: request.redirectUri,
        clientId: request.clientId,
      });
      setConnected(true);
      inFlightRef.current = false;
      return sync();
    } catch (connectError) {
      if (isAuthError(connectError)) {
        setConnected(false);
        setStatus('reauthRequired');
        setError(t('tasks.reauthRequired'));
      } else {
        setError(translateTasksError(connectError, t));
        setStatus(cacheRef.current.lastSyncedAt ? 'offline' : 'error');
      }
      recordTelemetry('connection.completed', {
        provider: 'google_tasks',
        action: 'connect',
        result: 'error',
        reason: connectError instanceof ConnectionApiError ? `http_${connectError.status}` : 'unknown',
      });
      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [configured, promptAsync, request, sync, t]);

  const disconnect = useCallback(async (): Promise<void> => {
    // Best-effort: un fallo de red no debe dejar caché viva ni un "conectado
    // fantasma" en la UI.
    if (configured) await disconnectGoogleTasksConnection().catch(() => undefined);
    await clearGoogleTasksCache().catch(() => undefined);
    setCache(EMPTY_CACHE);
    setConnected(false);
    setError(null);
    setStatus('idle');
  }, [configured]);

  const clearError = useCallback(() => setError(null), []);

  const platformHint = useMemo(() => {
    // Mismo criterio que Calendar: si falta el Client ID de la plataforma,
    // avisamos en texto en vez de dejar un botón que falla sin explicación.
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
      id: 'google-tasks',
      labelKey: 'tasks.title',
      status: connectionStatus,
      connected,
      configured,
      // Tasks escribe (espejo de metas y hábitos), a diferencia de lo que
      // decía el contrato de Calendar, que declaraba `write: false` siendo
      // que el espejo sí escribe.
      capabilities: { read: true, write: true, backgroundSync: false },
      data: cache.tasks,
      lastSyncedAt: cache.lastSyncedAt,
      error,
      platformHint,
      connect,
      sync,
      disconnect,
      clearError,
    }),
    [
      cache.tasks,
      cache.lastSyncedAt,
      connectionStatus,
      connected,
      configured,
      error,
      platformHint,
      connect,
      sync,
      disconnect,
      clearError,
    ],
  );
};
