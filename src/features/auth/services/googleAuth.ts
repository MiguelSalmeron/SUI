import {
  GoogleAuthProvider,
  linkWithCredential,
  signInWithCredential,
  type User,
} from 'firebase/auth';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import type { MigrationResult } from './accountMigration';

/**
 * True si el usuario ya tiene el proveedor Google vinculado.
 */
export const userHasGoogleProvider = (user: User | null | undefined): boolean =>
  !!user?.providerData?.some((p) => p.providerId === 'google.com');

const getGoogleErrorMessage = (error: unknown): string => {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/credential-already-in-use':
      return 'Esa cuenta Google ya existe. Cierra sesión y pulsa «Continuar con Google» en la bienvenida.';
    case 'auth/email-already-in-use':
      return 'Ese email de Google ya está en uso. Cierra sesión y entra con Continuar con Google.';
    case 'auth/account-exists-with-different-credential':
      return 'Ya existe una cuenta con ese email usando otro método de acceso.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Inicio de sesión cancelado.';
    case 'auth/requires-recent-login':
      return 'Por seguridad, vuelve a abrir la app e inténtalo de nuevo.';
    case 'auth/operation-not-allowed':
      return 'Google no está habilitado en Firebase Console.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Revisa tu red e inténtalo de nuevo.';
    case 'auth/invalid-credential':
      return 'Credencial de Google inválida o expirada. Inténtalo de nuevo.';
    default:
      return 'No se pudo completar el acceso con Google. Inténtalo de nuevo.';
  }
};

/**
 * Vincula Google a la sesión anónima (preserva UID) o inicia sesión con Google.
 *
 * Si el usuario ya tiene Google vinculado y no es anónimo, signInWithCredential
 * refresca la sesión (mismo UID).
 */
export const linkOrSignInWithGoogleIdToken = async (
  idToken: string,
): Promise<MigrationResult> => {
  const token = idToken.trim();
  if (!token) {
    return {
      ok: false,
      uid: auth.currentUser?.uid ?? '',
      linked: false,
      error: 'No se recibió token de Google.',
    };
  }

  const user = auth.currentUser as User | null;
  const credential = GoogleAuthProvider.credential(token);

  try {
    if (user?.isAnonymous) {
      await linkWithCredential(user, credential);
      return { ok: true, uid: user.uid, linked: true };
    }

    // Ya autenticado con Google: no hace falta re-login.
    if (user && userHasGoogleProvider(user)) {
      return { ok: true, uid: user.uid, linked: false };
    }

    const result = await signInWithCredential(auth, credential);
    return {
      ok: true,
      uid: result.user.uid,
      linked: false,
    };
  } catch (error) {
    return {
      ok: false,
      uid: user?.uid ?? '',
      linked: false,
      error: getGoogleErrorMessage(error),
    };
  }
};
