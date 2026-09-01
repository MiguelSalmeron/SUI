jest.mock('../sync/syncApi', () => ({ requestProductivitySync: jest.fn() }));

import { synchronizeProductivity, type SyncDependencies } from '../sync/syncCoordinator';
import type {
  ProductivityData,
  ProductivityEnvelopeV9,
  SyncMetadata,
  SyncMutation,
  SyncResponseV9,
} from '../sync/syncTypes';

const emptyData = (): ProductivityData => ({
  goals: [],
  habits: [],
  weeklyHistory: [],
  streakCount: 0,
  totalXp: 0,
});
const cursors = { goals: null, habits: null, snapshots: null };
const timestamp = { seconds: 1, nanoseconds: 0 };
const metadata: SyncMetadata = {
  schemaVersion: 2,
  serverRevision: 1,
  localRevision: 1,
  updatedAt: '2026-08-30T00:00:00.000Z',
  deviceId: 'device-a',
  fingerprint: 'local',
};
const mutation: SyncMutation = {
  mutationId: 'mutation-1',
  entityType: 'habit',
  entityId: 'habit-1',
  operation: 'upsert',
  payload: {
    id: 'habit-1',
    title: 'Local',
    completed: false,
    frequency: 'daily',
    streak: 0,
    createdAt: '2026-08-30',
  },
  baseServerRevision: 1,
  deviceId: 'device-a',
  clientUpdatedAt: '2026-08-30T00:00:00.000Z',
  fingerprint: 'local',
};

const envelope = (outbox: SyncMutation[] = [mutation]): ProductivityEnvelopeV9 => ({
  schemaVersion: 9,
  data: { ...emptyData(), habits: [mutation.payload as ProductivityData['habits'][number]] },
  metadata: { 'habit:habit-1': metadata },
  summaryMeta: null,
  outbox,
  pullState: { syncEpoch: 0, cursors, needsBootstrap: false, needsRebase: false },
  lastSyncedAt: null,
});

const response = (overrides: Partial<SyncResponseV9> = {}): SyncResponseV9 => ({
  schemaVersion: 9,
  resetRequired: false,
  syncEpoch: 0,
  compacted: 0,
  outcomes: [],
  changes: [],
  summary: null,
  cursors,
  upperBound: timestamp,
  hasMore: false,
  ...overrides,
});

const dependencies = (
  local: ProductivityEnvelopeV9,
  requestSync: SyncDependencies['requestSync'],
  loadLocal: SyncDependencies['loadLocal'] = jest.fn(async () => local),
): SyncDependencies => ({
  persistLocal: jest.fn(async () => local),
  loadLocal,
  writeLocal: jest.fn(async () => undefined),
  requestSync,
  getDeviceId: jest.fn(async () => 'device-a'),
  now: () => '2026-08-30T01:00:00.000Z',
});

describe('productivity sync coordinator v9', () => {
  it('retiene outbox si respuesta se pierde', async () => {
    const local = envelope();
    const deps = dependencies(
      local,
      jest.fn(async () => {
        throw new Error('network');
      }),
    );
    await expect(synchronizeProductivity('owner', local.data, deps)).rejects.toThrow('network');
    expect(deps.writeLocal).not.toHaveBeenCalled();
    expect(local.outbox).toEqual([mutation]);
  });

  it('conserva mutación creada durante vuelo', async () => {
    const initial = envelope();
    const newer: SyncMutation = {
      ...mutation,
      mutationId: 'mutation-2',
      fingerprint: 'newer',
      payload: { ...(mutation.payload as ProductivityData['habits'][number]), title: 'Nueva' },
    };
    const latest = envelope([newer]);
    latest.data.habits[0].title = 'Nueva';
    const deps = dependencies(
      initial,
      jest.fn(async () =>
        response({
          outcomes: [{ mutationId: 'mutation-1', status: 'applied', serverRevision: 2 }],
        }),
      ),
      jest.fn(async () => latest),
    );
    const result = await synchronizeProductivity('owner', initial.data, deps);
    expect(result.pending).toBe(1);
    expect(result.data.habits[0].title).toBe('Nueva');
  });

  it('stale recibe estado autoritativo y converge', async () => {
    const local = envelope();
    const authoritative = {
      entityType: 'habit' as const,
      entityId: 'habit-1',
      data: { ...(mutation.payload as ProductivityData['habits'][number]), title: 'Servidor' },
      meta: {
        schemaVersion: 2 as const,
        serverRevision: 2,
        originDeviceId: 'device-b',
        clientUpdatedAt: '2026-08-30T00:00:01.000Z',
        fingerprint: 'server',
        lastMutationId: 'other',
      },
      serverUpdatedAt: timestamp,
    };
    const deps = dependencies(
      local,
      jest.fn(async () =>
        response({
          outcomes: [
            {
              mutationId: 'mutation-1',
              status: 'rejected',
              serverRevision: 2,
              reason: 'stale',
              authoritative,
            },
          ],
        }),
      ),
    );
    const result = await synchronizeProductivity('owner', local.data, deps);
    expect(result.rejected).toBe(1);
    expect(result.pending).toBe(0);
    expect(result.data.habits[0].title).toBe('Servidor');
  });

  it('pagina con upper bound fijo y mutaciones sólo en primera página', async () => {
    const local = envelope();
    const requestSync = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          hasMore: true,
          cursors: { ...cursors, habits: { ...timestamp, documentId: 'habit-1' } },
        }),
      )
      .mockResolvedValueOnce(
        response({
          outcomes: [{ mutationId: 'mutation-1', status: 'replayed', serverRevision: 2 }],
        }),
      );
    const result = await synchronizeProductivity(
      'owner',
      local.data,
      dependencies(local, requestSync),
    );
    expect(result.pages).toBe(2);
    expect(requestSync.mock.calls[0][0].mutations).toHaveLength(1);
    expect(requestSync.mock.calls[1][0].mutations).toHaveLength(0);
    expect(requestSync.mock.calls[1][0].pull.upperBound).toEqual(timestamp);
  });

  it('epoch distinto hace bootstrap, descarta entidad compactada y luego pull', async () => {
    let state = envelope();
    const requestSync = jest
      .fn()
      .mockResolvedValueOnce(response({ resetRequired: true, syncEpoch: 2 }))
      .mockResolvedValueOnce(response({ syncEpoch: 2 }))
      .mockResolvedValueOnce(response({ syncEpoch: 2 }));
    const deps: SyncDependencies = {
      persistLocal: jest.fn(async () => state),
      loadLocal: jest.fn(async () => state),
      writeLocal: jest.fn(async (value) => {
        state = value;
      }),
      requestSync,
      getDeviceId: jest.fn(async () => 'device-a'),
      now: () => '2026-08-30T01:00:00.000Z',
    };

    const result = await synchronizeProductivity('owner', state.data, deps);

    expect(result.epochResets).toBe(1);
    expect(result.pending).toBe(0);
    expect(result.data.habits).toEqual([]);
    expect(requestSync.mock.calls.map((call) => call[0].pull.mode)).toEqual([
      'incremental',
      'bootstrap',
      'incremental',
    ]);
    expect(requestSync.mock.calls[2][0].mutations).toEqual([]);
  });
});
