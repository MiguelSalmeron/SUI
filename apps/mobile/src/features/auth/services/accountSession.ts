/**
 * Operaciones de sesión y cuenta del usuario actual.
 *
 * Vive en la feature de auth porque es su dueña: Ajustes y cualquier otra
 * pantalla consumen estas funciones por `@/features/auth/public` en lugar de
 * hablar con el SDK de Firebase directamente. Así el resto de la aplicación no
 * conoce el cliente de Auth y el acceso al SDK queda en dos lugares: esta
 * feature y `shared/infrastructure`.
 */

import { deleteUser, sendEmailVerification, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth } from '@/shared/infrastructure/firebase/firebase';

/** Cierra la sesión actual. */
export const signOutCurrentUser = async (): Promise<void> => {
  await signOut(auth);
};

/**
 * Elimina la cuenta anónima actual.
 * Las cuentas registradas se eliminan con `deleteRegisteredAccount`, que pasa
 * por el backend para purgar el documento y los datos asociados.
 */
export const deleteAnonymousUser = async (): Promise<void> => {
  const user = auth.currentUser;
  if (user) await deleteUser(user);
};

/** Reenvía el correo de verificación al usuario actual. */
export const resendVerificationEmail = async (): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('auth/no-current-user');
  await sendEmailVerification(user);
};

/** Envía al correo del usuario actual el enlace para restablecer la contraseña. */
export const requestPasswordResetForCurrentUser = async (): Promise<void> => {
  const email = auth.currentUser?.email;
  if (!email) throw new Error('auth/no-current-user-email');
  await sendPasswordResetEmail(auth, email);
};
