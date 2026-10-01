import { auth } from '@/shared/infrastructure/firebase/firebase';

const AUTH_READY_TIMEOUT_MS = 4000;

/**
 * Banderas de concurrencia del store.
 *
 * Viven en el módulo y no en el estado de zustand a propósito: no deben
 * disparar renders ni persistirse, solo evitar que dos guardados o dos syncs
 * corran encima. Al estar fuera del estado, los slices las comparten sin
 * pasarlas por parámetros.
 */
export const productivityRuntime = {
  saveInFlight: false,
  saveQueued: false,
  syncInFlight: false,
  syncQueued: false,
  /** uid dueño de los datos cargados; `null` mientras no hay sesión. */
  loadedForUid: null as string | null,
};

// La sesión persistida se restaura de forma asíncrona; sin esta espera
// loadState leería la clave base (sin uid) y quedaría stateLoaded=true con
// los datos del usuario invisibles hasta reiniciar la app.
export const waitForAuthReady = async (): Promise<void> => {
  try {
    await Promise.race([
      auth.authStateReady?.() ?? Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, AUTH_READY_TIMEOUT_MS)),
    ]);
  } catch {
    // Local-first: un SDK de auth que no responde no debe bloquear la carga.
  }
};
