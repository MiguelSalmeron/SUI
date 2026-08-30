jest.mock('../sync/cloudProductivity', () => ({
  applyCloudMutations: jest.fn(),
  loadCloudProductivity: jest.fn(),
}));

import { synchronizeProductivity, type SyncDependencies } from '../sync/syncCoordinator';
import type {
  CloudMutationResult,
  ProductivityData,
  ProductivityEnvelopeV8,
  SyncMetadata,
  SyncMutation,
} from '../sync/syncTypes';

const emptyData = (): ProductivityData => ({
  goals: [],
  habits: [],
  weeklyHistory: [],
  streakCount: 0,
  totalXp: 0,
});

const metadata = (revision: number, deviceId: string, fingerprint: string): SyncMetadata => ({
  schemaVersion: 1,
  updatedAt: '2026-08-30T00:00:00.000Z',
  revision,
  deviceId,
  fingerprint,
});

const habitMutation = (mutationId: string, title: string, meta: SyncMetadata): SyncMutation => ({
  mutationId,
  entityType: 'habit',
  entityId: 'habit-1',
  operation: 'upsert',
  payload: {
    id: 'habit-1',
    title,
    completed: false,
    frequency: 'daily',
    streak: 0,
    createdAt: '2026-08-30',
  },
  meta,
});

const envelope = (
  data: ProductivityData,
  outbox: SyncMutation[],
  entityMeta?: SyncMetadata,
): ProductivityEnvelopeV8 => ({
  schemaVersion: 8,
  data,
  metadata: entityMeta ? { 'habit:habit-1': entityMeta } : {},
  summaryMeta: null,
  outbox,
  lastSyncedAt: null,
});

const mutationResult = (
  mutationId: string,
  status: 'applied' | 'replayed' | 'rejected',
): CloudMutationResult => ({
  outcomes: [{ mutationId, status, collision: false }],
  accepted: status === 'applied' ? 1 : 0,
  replayed: status === 'replayed' ? 1 : 0,
  rejected: status === 'rejected' ? 1 : 0,
  collisions: 0,
});

describe('productivity sync coordinator', () => {
  it('conserva mutación creada durante sync y la superpone al pull', async () => {
    const oldMeta = metadata(1, 'device-a', 'old');
    const newMeta = metadata(2, 'device-a', 'new');
    const oldMutation = habitMutation('mutation-old', 'Anterior', oldMeta);
    const newMutation = habitMutation('mutation-new', 'Nueva', newMeta);
    const initial = envelope(emptyData(), [oldMutation], oldMeta);
    const latest = envelope(emptyData(), [newMutation], newMeta);
    const written: ProductivityEnvelopeV8[] = [];
    const dependencies: SyncDependencies = {
      persistLocal: jest.fn(async () => initial),
      applyCloud: jest.fn(async () => mutationResult('mutation-old', 'applied')),
      loadLocal: jest.fn(async () => latest),
      loadCloud: jest.fn(async () => ({
        data: emptyData(),
        metadata: { 'habit:habit-1': oldMeta },
        summaryMeta: null,
        migratedLegacy: false,
      })),
      writeLocal: jest.fn(async (value) => {
        written.push(value);
      }),
      now: () => '2026-08-30T01:00:00.000Z',
    };

    const result = await synchronizeProductivity('owner', emptyData(), dependencies);

    expect(result.pending).toBe(1);
    expect(result.data.habits[0].title).toBe('Nueva');
    expect(written[0].outbox).toEqual([newMutation]);
  });

  it('descarta mutación rechazada y converge al remoto', async () => {
    const localMeta = metadata(2, 'device-a', 'local');
    const remoteMeta = metadata(2, 'device-z', 'remote');
    const mutation = habitMutation('mutation-local', 'Local', localMeta);
    const local = envelope(emptyData(), [mutation], localMeta);
    const remote = emptyData();
    remote.habits = [
      {
        id: 'habit-1',
        title: 'Remoto',
        completed: false,
        frequency: 'daily',
        streak: 0,
        createdAt: '2026-08-30',
      },
    ];
    const written: ProductivityEnvelopeV8[] = [];
    const dependencies: SyncDependencies = {
      persistLocal: jest.fn(async () => local),
      applyCloud: jest.fn(async () => mutationResult('mutation-local', 'rejected')),
      loadLocal: jest.fn(async () => local),
      loadCloud: jest.fn(async () => ({
        data: remote,
        metadata: { 'habit:habit-1': remoteMeta },
        summaryMeta: null,
        migratedLegacy: false,
      })),
      writeLocal: jest.fn(async (value) => {
        written.push(value);
      }),
      now: () => '2026-08-30T01:00:00.000Z',
    };

    const result = await synchronizeProductivity('owner', local.data, dependencies);

    expect(result.rejected).toBe(1);
    expect(result.pending).toBe(0);
    expect(result.data.habits[0].title).toBe('Remoto');
    expect(written[0].outbox).toEqual([]);
  });

  it('retiene outbox completo cuando falla push parcial', async () => {
    const localMeta = metadata(1, 'device-a', 'local');
    const mutation = habitMutation('mutation-local', 'Local', localMeta);
    const local = envelope(emptyData(), [mutation], localMeta);
    const writeLocal = jest.fn(async () => undefined);
    const dependencies: SyncDependencies = {
      persistLocal: jest.fn(async () => local),
      applyCloud: jest.fn(async () => {
        throw new Error('network');
      }),
      loadLocal: jest.fn(async () => local),
      loadCloud: jest.fn(async () => null),
      writeLocal,
      now: () => '2026-08-30T01:00:00.000Z',
    };

    await expect(synchronizeProductivity('owner', local.data, dependencies)).rejects.toThrow(
      'network',
    );
    expect(writeLocal).not.toHaveBeenCalled();
    expect(local.outbox).toEqual([mutation]);
  });
});
