import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { linkOrSignInWithGoogleIdToken } from '../services/googleAuth';
import type { MigrationResult } from '../services/accountMigration';

WebBrowser.maybeCompleteAuthSession();

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
const androidClientId =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || undefined;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined;

/** Placeholder para satisfacer invariantClientId por plataforma sin crashear el árbol. */
const PLACEHOLDER_CLIENT_ID = 'missing.apps.googleusercontent.com';

const cancelledResult = (): MigrationResult => ({
  ok: false,
  uid: '',
  linked: false,
  cancelled: true,
});

/**
 * Prompt Google OAuth (id_token) → link/sign-in Firebase.
 *
 * Importante: Expo resuelve clientId por OS (`androidClientId` / `iosClientId` /
 * `webClientId`). Hay que pasar también `clientId` (web) como fallback; si no,
 * Android/iOS sin client nativo lanzan en el mount del hook.
 */
export const useGoogleAuth = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const configured = Boolean(webClientId);
  const effectiveWebId = configured ? webClientId : PLACEHOLDER_CLIENT_ID;

  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    clientId: effectiveWebId,
    webClientId: effectiveWebId,
    androidClientId: configured ? androidClientId || effectiveWebId : PLACEHOLDER_CLIENT_ID,
    iosClientId: configured ? iosClientId || effectiveWebId : PLACEHOLDER_CLIENT_ID,
    selectAccount: true,
  });

  const platformHint = useMemo(() => {
    if (Platform.OS === 'android' && configured && !androidClientId) {
      return 'En Android configura EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID y SHA-1 de firma.';
    }
    if (Platform.OS === 'ios' && configured && !iosClientId) {
      return 'En iOS configura EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.';
    }
    return null;
  }, [configured]);

  const clearError = useCallback(() => setError(null), []);

  const signInWithGoogle = useCallback(async (): Promise<MigrationResult> => {
    if (inFlightRef.current) {
      return cancelledResult();
    }

    if (!configured) {
      const result: MigrationResult = {
        ok: false,
        uid: '',
        linked: false,
        error:
          'Google no configurado. Añade EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.',
      };
      setError(result.error ?? null);
      return result;
    }

    if (!request) {
      const result: MigrationResult = {
        ok: false,
        uid: '',
        linked: false,
        error: 'Google aún se está preparando. Espera un segundo e inténtalo de nuevo.',
      };
      setError(result.error ?? null);
      return result;
    }

    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const authResult = await promptAsync();

      if (authResult.type === 'dismiss' || authResult.type === 'cancel') {
        return cancelledResult();
      }

      if (authResult.type !== 'success') {
        const result: MigrationResult = {
          ok: false,
          uid: '',
          linked: false,
          error: 'No se pudo completar el acceso con Google.',
        };
        setError(result.error ?? null);
        return result;
      }

      const idToken =
        authResult.params.id_token ||
        authResult.authentication?.idToken ||
        '';

      if (!idToken) {
        const result: MigrationResult = {
          ok: false,
          uid: '',
          linked: false,
          error: 'No se recibió token de Google.',
        };
        setError(result.error ?? null);
        return result;
      }

      const migration = await linkOrSignInWithGoogleIdToken(idToken);
      if (!migration.ok) {
        setError(migration.error ?? null);
      }
      return migration;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo completar el acceso con Google.';
      setError(message);
      return { ok: false, uid: '', linked: false, error: message };
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }, [configured, promptAsync, request]);

  return useMemo(
    () => ({
      signInWithGoogle,
      busy,
      error,
      ready: configured && request !== null,
      configured,
      platformHint,
      clearError,
    }),
    [signInWithGoogle, busy, error, configured, request, platformHint, clearError],
  );
};
