import type { SyncMetadata } from './syncTypes';

export type ConflictDecision = 'incoming' | 'current' | 'equal' | 'collision';

export const resolveMetadataConflict = (
  incoming: SyncMetadata,
  current?: SyncMetadata,
): ConflictDecision => {
  if (!current) return 'incoming';
  if (incoming.revision !== current.revision) {
    return incoming.revision > current.revision ? 'incoming' : 'current';
  }
  if (incoming.deviceId !== current.deviceId) {
    return incoming.deviceId > current.deviceId ? 'incoming' : 'current';
  }
  return incoming.fingerprint === current.fingerprint ? 'equal' : 'collision';
};
