import { useGoogleCalendar } from '@/features/calendar/public';
import { useGoogleTasks } from '@/features/tasks/public';
import { PRODUCT_CONFIG } from '@/shared/config/product';
import type { IoniconName } from '@/shared/ui/Ionicons';
import type { ConnectionProvider } from '@/features/connections/public';

/**
 * Registro de conectores de la pantalla Conectores.
 *
 * Vive en `settings` y no en `connections` a propósito: `check-architecture.mjs`
 * arma un grafo por feature y falla con `feature cycle`. El contrato vive en
 * `connections`, `calendar` lo implementa, y un registro en `connections`
 * tendría que importar `calendar` para construir la tarjeta — cerrando el ciclo
 * `calendar → connections → calendar`. `settings` ya depende de ambos, así que
 * componer acá no agrega aristas nuevas.
 *
 * Google Tasks es feature aparte (`@/features/tasks/public`) por la misma
 * razón: `connections/public` debe quedar liviano y sin dependencias pesadas.
 *
 * Agregar un provider es un archivo nuevo más una línea en `CONNECTIONS`. La
 * pantalla no se toca.
 */
export type ConnectionDefinition = {
  id: string;
  icon: IoniconName;
  /**
   * Si el provider puede usarse en este entorno. Cuando devuelve `false`, la
   * tarjeta **no se renderiza**: no aparece apagada ni con un «próximamente».
   * La pantalla no promete lo que no existe.
   */
  enabled: () => boolean;
  useProvider: () => ConnectionProvider<unknown>;
};

export const CONNECTIONS: readonly ConnectionDefinition[] = [
  {
    id: 'google-calendar',
    icon: 'logo-google',
    enabled: () => true,
    useProvider: () => useGoogleCalendar() as ConnectionProvider<unknown>,
  },
  {
    id: 'google-tasks',
    icon: 'checkbox-outline',
    // Atrás del flag: el conector es nuevo y su alcance en producción todavía
    // no está aprobado. Apagado, no aparece.
    enabled: () => PRODUCT_CONFIG.googleTasksEnabled,
    useProvider: () => useGoogleTasks() as ConnectionProvider<unknown>,
  },
];

/** Proveedores visibles en este entorno, en orden de presentación. */
export const visibleConnections = (): readonly ConnectionDefinition[] =>
  CONNECTIONS.filter((definition) => definition.enabled());

/**
 * Un estado `reauthRequired` manda sobre `connected`: si Google revocó el
 * permiso, la conexión no sirve aunque el documento siga existiendo.
 */
export const isConnected = (provider: ConnectionProvider<unknown>): boolean =>
  provider.connected && provider.status !== 'reauthRequired';
