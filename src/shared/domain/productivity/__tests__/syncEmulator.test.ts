import fs from 'node:fs/promises';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { applyCloudMutations, loadCloudProductivity } from '../sync/cloudProductivity';
import type { Firestore } from 'firebase/firestore';
import type { SyncMetadata, SyncMutation } from '../sync/syncTypes';

const describeWithEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

const metadata = (
  revision: number,
  deviceId: string,
  fingerprint: string,
  updatedAt: string,
  deletedAt?: string,
): SyncMetadata => ({
  schemaVersion: 1,
  revision,
  deviceId,
  fingerprint,
  updatedAt,
  ...(deletedAt ? { deletedAt } : {}),
});

const habitMutation = (
  mutationId: string,
  title: string,
  meta: SyncMetadata,
  operation: 'upsert' | 'delete' = 'upsert',
): SyncMutation => ({
  mutationId,
  entityType: 'habit',
  entityId: 'habit-1',
  operation,
  payload:
    operation === 'delete'
      ? null
      : {
          id: 'habit-1',
          title,
          completed: false,
          frequency: 'daily',
          streak: 0,
          createdAt: '2026-08-30',
        },
  meta,
});

describeWithEmulator('productivity sync emulator', () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: 'sui-rules-test',
      firestore: { rules: await fs.readFile('firestore.rules', 'utf8') },
    });
  });

  beforeEach(async () => environment.clearFirestore());
  afterAll(async () => environment.cleanup());

  const database = () =>
    environment
      .authenticatedContext('owner', {
        firebase: { sign_in_provider: 'password' },
        email_verified: true,
      })
      .firestore() as unknown as Firestore;

  it('hace converger ediciones simultáneas y replay sin depender del reloj', async () => {
    const db = database();
    const deviceA = habitMutation(
      'mutation-a',
      'Cliente A',
      metadata(2, 'device-a', 'fingerprint-a', '2099-01-01T00:00:00.000Z'),
    );
    const deviceZ = habitMutation(
      'mutation-z',
      'Cliente Z',
      metadata(2, 'device-z', 'fingerprint-z', '2000-01-01T00:00:00.000Z'),
    );

    await applyCloudMutations('owner', [deviceA], db);
    const winning = await applyCloudMutations('owner', [deviceZ], db);
    const stale = await applyCloudMutations('owner', [deviceA], db);
    const replay = await applyCloudMutations('owner', [deviceZ], db);
    const collision = await applyCloudMutations(
      'owner',
      [
        habitMutation(
          'mutation-collision',
          'Colisión',
          metadata(2, 'device-z', 'different', '2000-01-01T00:00:00.000Z'),
        ),
      ],
      db,
    );
    const clientA = await loadCloudProductivity('owner', db);
    const clientZ = await loadCloudProductivity('owner', db);

    expect(winning.accepted).toBe(1);
    expect(stale.rejected).toBe(1);
    expect(replay.replayed).toBe(1);
    expect(collision.collisions).toBe(1);
    expect(clientA).toEqual(clientZ);
    expect(clientA?.data.habits[0].title).toBe('Cliente Z');
  });

  it('resuelve update contra delete y conserva entidades independientes', async () => {
    const db = database();
    const update = habitMutation(
      'mutation-update',
      'Actualizar',
      metadata(3, 'device-a', 'updated', '2026-08-30T00:00:00.000Z'),
    );
    const remove = habitMutation(
      'mutation-delete',
      'Eliminar',
      metadata(3, 'device-z', 'deleted', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z'),
      'delete',
    );
    const goal: SyncMutation = {
      mutationId: 'mutation-goal',
      entityType: 'goal',
      entityId: 'goal-1',
      operation: 'upsert',
      payload: {
        id: 'goal-1',
        title: 'Meta independiente',
        deadline: '2026-09-01',
        progress: 0,
        milestones: [],
        impactDays: [],
        completed: false,
        gravity: 'low',
        createdAt: '2026-08-30',
      },
      meta: metadata(1, 'device-a', 'goal', '2026-08-30T00:00:00.000Z'),
    };

    await applyCloudMutations('owner', [update, goal], db);
    const deletion = await applyCloudMutations('owner', [remove], db);
    const cloud = await loadCloudProductivity('owner', db);

    expect(deletion.accepted).toBe(1);
    expect(cloud?.data.habits).toEqual([]);
    expect(cloud?.data.goals.map((item) => item.id)).toEqual(['goal-1']);
  });

  it('aplica misma política al resumen', async () => {
    const db = database();
    const summary = (mutationId: string, totalXp: number, meta: SyncMetadata): SyncMutation => ({
      mutationId,
      entityType: 'summary',
      entityId: 'singleton',
      operation: 'upsert',
      payload: { streakCount: 2, totalXp },
      meta,
    });
    const deviceA = summary(
      'summary-a',
      10,
      metadata(1, 'device-a', 'summary-a', '2099-01-01T00:00:00.000Z'),
    );
    const deviceZ = summary(
      'summary-z',
      50,
      metadata(1, 'device-z', 'summary-z', '2000-01-01T00:00:00.000Z'),
    );

    await applyCloudMutations('owner', [deviceA], db);
    await applyCloudMutations('owner', [deviceZ], db);
    const stale = await applyCloudMutations('owner', [deviceA], db);
    const cloud = await loadCloudProductivity('owner', db);

    expect(stale.rejected).toBe(1);
    expect(cloud?.data.totalXp).toBe(50);
    expect(cloud?.summaryMeta?.deviceId).toBe('device-z');
  });
});
