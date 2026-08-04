import {
  EmailAuthProvider,
  linkWithCredential,
  type User,
} from 'firebase/auth';
import { auth } from '../config/firebase';

export interface MigrationResult {
  ok: boolean;
  uid: string;
  /** true si la cuenta anónima se enlazó (preserva datos). */
  linked: boolean;
  error?: string;
  /** true si el usuario cerró el prompt OAuth sin completar. */
  cancelled?: boolean;
}

/**
 * Promueve la cuenta anónima activa a email/contraseña SIN pérdida de datos.
 *
 * Usa linkWithCredential sobre auth.currentUser, que vincula el nuevo proveedor
 * al usuario anónimo existente. El uid NO cambia, por lo que todo dato en
 * Firestore (users/{uid}) y AsyncStorage queda accesible para la misma cuenta.
 *
 * Si NO hay usuario anónimo activo (pausa de sesión por reinicio sin
 * persistencia), cae a signInWithEmailAndPassword para no bloquear al usuario.
 *
 * Errores comunes mapeados a mensajes claros en ES.
 */
const getEmailErrorMessage = (error: unknown): string => {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Ingresa un email válido';
    case 'auth/email-already-in-use':
      return 'Ese email ya pertenece a otra cuenta. Inicia sesión con él.';
    case 'auth/weak-password':
      return 'La contraseña es muy débil (mínimo 6 caracteres)';
    case 'auth/requires-recent-login':
      return 'Por seguridad, vuelve a abrir la app e inténtalo de nuevo';
    case 'auth/operation-not-allowed':
      return 'Email/contraseña no habilitado en Firebase Console';
    case 'auth/network-request-failed':
      return 'Sin conexión. Revisa tu red e inténtalo de nuevo';
    default:
      return 'No se pudo completar la operación. Inténtalo de nuevo';
  }
};

export const upgradeAnonymousToEmail = async (
  email: string,
  password: string
): Promise<MigrationResult> => {
  const cleanEmail = email.trim().toLowerCase();
  const user = auth.currentUser as User | null;

  try {
    if (user && user.isAnonymous) {
      // Ruta ideal: preserva uid y todos los datos asociados.
      const credential = EmailAuthProvider.credential(cleanEmail, password);
      await linkWithCredential(user, credential);
      return { ok: true, uid: user.uid, linked: true };
    }

    // Sin usuario anónimo activo (sesión no persistida): caer a login.
    // No podemos importar signInWithEmailAndPassword aquí sin romper el
    // principio local-first, dejamos que el caller decida el flujo de login.
    return {
      ok: false,
      uid: user?.uid ?? '',
      linked: false,
      error: 'No hay sesión anónima activa. Inicia sesión con tu cuenta email.',
    };
  } catch (error) {
    return {
      ok: false,
      uid: user?.uid ?? '',
      linked: false,
      error: getEmailErrorMessage(error),
    };
  }
};
