export type ConnectionStatus =
  'disconnected' | 'connecting' | 'connected' | 'syncing' | 'offline' | 'error';

export type ConnectionCapabilities = {
  read: boolean;
  write: boolean;
  backgroundSync: boolean;
};

export interface ConnectionProvider<TData> {
  id: string;
  status: ConnectionStatus;
  connected: boolean;
  configured: boolean;
  capabilities: ConnectionCapabilities;
  data: TData;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  sync: () => Promise<boolean>;
}
