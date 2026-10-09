import type { TranslationKey } from '@/shared/i18n/translations';

export type ConnectionStatus =
  'disconnected' | 'connecting' | 'connected' | 'syncing' | 'offline' | 'reauthRequired' | 'error';

export type ConnectionCapabilities = {
  read: boolean;
  write: boolean;
  backgroundSync: boolean;
};

export interface ConnectionProvider<TData> {
  id: string;
  /**
   * Clave i18n del nombre visible. La pantalla resuelve por clave, nunca por
   * texto fijo: así el mismo `ConnectionCard` sirve para todos los providers y
   * el copy ES/EN no se duplica por proveedor.
   */
  labelKey: TranslationKey;
  status: ConnectionStatus;
  connected: boolean;
  configured: boolean;
  capabilities: ConnectionCapabilities;
  data: TData;
  /** Último sync exitoso, para la línea de fecha de la tarjeta. */
  lastSyncedAt: number | null;
  /** Mensaje ya traducido, listo para pintar. `null` cuando no hay falla. */
  error: string | null;
  /** Aviso de configuración del entorno (por ejemplo, falta un Client ID). */
  platformHint: string | null;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  sync: () => Promise<boolean>;
  clearError: () => void;
}
