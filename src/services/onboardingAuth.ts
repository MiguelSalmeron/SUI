import { signInAnonymously } from 'firebase/auth';
import { auth } from '../config/firebase';

export interface AnonAuthResult {
  uid: string | null;
  /** true si el alta anónima falló (p. ej. sin red) y debe reintentarse. */
  syncPending: boolean;
}

/**
 * Dispara la autenticación anónima silenciosa de Firebase.
 *
 * Siguiendo la mitigación de riesgo "Falla de Firebase Auth Offline":
 * nunca lanza. Si falla, devuelve syncPending=true para que el onboarding
 * pueda completarse igual en modo local-first y reintentar más tarde.
 */
export const signInAnon = async (): Promise<AnonAuthResult> => {
  // Si ya hay sesión activa, reutilizarla.
  if (auth.currentUser) {
    return { uid: auth.currentUser.uid, syncPending: false };
  }

  try {
    const credential = await signInAnonymously(auth);
    return { uid: credential.user.uid, syncPending: false };
  } catch (error) {
    console.warn('Auth anónima falló, se reintentará luego:', error);
    return { uid: null, syncPending: true };
  }
};
