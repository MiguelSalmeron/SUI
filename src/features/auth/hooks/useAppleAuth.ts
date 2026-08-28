import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { linkOrSignInWithAppleToken } from '../services/appleAuth';
import type { MigrationResult } from '../services/accountMigration';

export const useAppleAuth = () => {
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(Platform.OS === 'ios');

  const refreshAvailability = useCallback(() => {
    if (Platform.OS !== 'ios') {
      setAvailable(false);
      return;
    }
    void AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    refreshAvailability();
  }, [refreshAvailability]);

  const signInWithApple = useCallback(async (): Promise<MigrationResult> => {
    if (!available || busy) return { ok: false, uid: '', linked: false, cancelled: true };
    setBusy(true);
    try {
      const rawNonce = Crypto.randomUUID();
      const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });
      if (!credential.identityToken) {
        return { ok: false, uid: '', linked: false, error: 'Apple no devolvió una identidad válida.' };
      }
      return linkOrSignInWithAppleToken(credential.identityToken, rawNonce);
    } catch (error) {
      if ((error as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
        return { ok: false, uid: '', linked: false, cancelled: true };
      }
      return { ok: false, uid: '', linked: false, error: 'No se pudo completar el acceso con Apple.' };
    } finally {
      setBusy(false);
    }
  }, [available, busy]);

  return useMemo(
    () => ({ available, busy, signInWithApple, refreshAvailability }),
    [available, busy, signInWithApple, refreshAvailability],
  );
};
