import type {
  CloudChange,
  CloudMetadataV2,
  MutationOutcomeV9,
  SummaryChange,
  SyncMutationV9,
} from './types';

export interface CurrentMutationState {
  exists: boolean;
  revision: number;
  lastMutationId?: string;
  authoritative: CloudChange | SummaryChange | null;
}

export type MutationDecision =
  | { outcome: MutationOutcomeV9; apply: false }
  | { outcome: MutationOutcomeV9; apply: true; nextMeta: CloudMetadataV2 };

export const decideMutation = (
  mutation: SyncMutationV9,
  current: CurrentMutationState,
): MutationDecision => {
  if (current.lastMutationId === mutation.mutationId) {
    return {
      apply: false,
      outcome: {
        mutationId: mutation.mutationId,
        status: 'replayed',
        serverRevision: current.revision,
        authoritative: current.authoritative,
      },
    };
  }
  if (!current.exists && mutation.operation === 'delete' && mutation.baseServerRevision === 0) {
    return {
      apply: false,
      outcome: {
        mutationId: mutation.mutationId,
        status: 'replayed',
        serverRevision: 0,
        authoritative: null,
      },
    };
  }
  if (
    mutation.baseServerRevision !== current.revision ||
    (!current.exists && current.revision > 0)
  ) {
    return {
      apply: false,
      outcome: {
        mutationId: mutation.mutationId,
        status: 'rejected',
        serverRevision: current.revision,
        reason: current.exists ? 'stale' : 'missing',
        authoritative: current.authoritative,
      },
    };
  }
  const serverRevision = current.revision + 1;
  return {
    apply: true,
    outcome: { mutationId: mutation.mutationId, status: 'applied', serverRevision },
    nextMeta: {
      schemaVersion: 2,
      serverRevision,
      originDeviceId: mutation.deviceId,
      clientUpdatedAt: mutation.clientUpdatedAt,
      fingerprint: mutation.fingerprint,
      lastMutationId: mutation.mutationId,
    },
  };
};
