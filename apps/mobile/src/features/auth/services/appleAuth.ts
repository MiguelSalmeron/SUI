import { OAuthProvider, linkWithCredential, signInWithCredential } from 'firebase/auth';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import type { MigrationResult } from './accountMigration';

export const linkOrSignInWithAppleToken = async (
  identityToken: string,
  rawNonce: string,
): Promise<MigrationResult> => {
  const user = auth.currentUser;
  try {
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({ idToken: identityToken, rawNonce });
    if (user?.isAnonymous) {
      const result = await linkWithCredential(user, credential);
      return { ok: true, uid: result.user.uid, linked: true };
    }
    const result = await signInWithCredential(auth, credential);
    return { ok: true, uid: result.user.uid, linked: false };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (user?.isAnonymous && code === 'auth/credential-already-in-use') {
      try {
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({ idToken: identityToken, rawNonce });
        const result = await signInWithCredential(auth, credential);
        return { ok: true, uid: result.user.uid, linked: false };
      } catch {
        return {
          ok: false,
          uid: user.uid,
          linked: false,
          error: 'No se pudo completar el acceso con Apple.',
        };
      }
    }
    return {
      ok: false,
      uid: user?.uid ?? '',
      linked: false,
      error:
        code === 'auth/credential-already-in-use'
          ? 'Esa cuenta Apple ya está vinculada a otra cuenta.'
          : 'No se pudo completar el acceso con Apple.',
    };
  }
};
