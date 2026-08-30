import AsyncStorage from '@react-native-async-storage/async-storage';
import { HOME_STATE_KEY } from '../model/homeStorage';

let uuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => `uuid-${++uuid}`) }));

import {
  LEGACY_PRODUCTIVITY_STORAGE_KEY,
  LEGACY_PRODUCTIVITY_V8_STORAGE_KEY,
  PRODUCTIVITY_STORAGE_KEY,
  applyPendingMutations,
  clearLocalProductivity,
  loadLocalProductivity,
  persistLocalProductivity,
  rebasePendingMutations,
  replaceLocalProductivity,
} from '../persistence/productivityRepository';
import type { ProductivityData, SyncMetadata, SyncMutation } from '../sync/syncTypes';

const emptyData = (): ProductivityData => ({
  goals: [],
  habits: [],
  weeklyHistory: [],
  streakCount: 0,
  totalXp: 0,
});

const habit = (title = 'Caminar') => ({
  id: 'habit-1',
  title,
  completed: false,
  frequency: 'daily' as const,
  streak: 0,
  createdAt: '2026-08-27',
});

const cloudMeta = (serverRevision: number, fingerprint: string): SyncMetadata => ({
  schemaVersion: 2,
  serverRevision,
  localRevision: 0,
  updatedAt: '2026-08-30T00:00:00.000Z',
  deviceId: 'cloud',
  fingerprint,
});

describe('productivity repository v9', () => {
  beforeEach(() => {
    uuid = 0;
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
  });

  it('migra v8 primero, conserva respaldo y marca rebase', async () => {
    const legacy = {
      schemaVersion: 8,
      data: { ...emptyData(), habits: [habit('Pendiente')] },
      metadata: {
        'habit:habit-1': {
          schemaVersion: 1,
          revision: 3,
          updatedAt: '2026-08-29T00:00:00.000Z',
          deviceId: 'old-device',
          fingerprint: 'pending',
        },
      },
      summaryMeta: null,
      outbox: [
        {
          mutationId: 'old-mutation',
          entityType: 'habit',
          entityId: 'habit-1',
          operation: 'upsert',
          payload: habit('Pendiente'),
          meta: {
            schemaVersion: 1,
            revision: 3,
            updatedAt: '2026-08-29T00:00:00.000Z',
            deviceId: 'old-device',
            fingerprint: 'pending',
          },
        },
      ],
      lastSyncedAt: null,
    };
    await AsyncStorage.setItem(LEGACY_PRODUCTIVITY_V8_STORAGE_KEY, JSON.stringify(legacy));

    const envelope = await loadLocalProductivity();

    expect(envelope.schemaVersion).toBe(9);
    expect(envelope.pullState).toMatchObject({ needsBootstrap: true, needsRebase: true });
    expect(envelope.outbox[0].baseServerRevision).toBe(0);
    expect(await AsyncStorage.getItem(LEGACY_PRODUCTIVITY_V8_STORAGE_KEY)).toBe(
      JSON.stringify(legacy),
    );
  });

  it('migra v7, luego v6, cuando versiones superiores son inválidas', async () => {
    await AsyncStorage.setItem(LEGACY_PRODUCTIVITY_V8_STORAGE_KEY, '{invalid');
    await AsyncStorage.setItem(LEGACY_PRODUCTIVITY_STORAGE_KEY, '{invalid');
    await AsyncStorage.setItem(HOME_STATE_KEY, JSON.stringify({ ...emptyData(), totalXp: 15 }));

    expect((await loadLocalProductivity()).data.totalXp).toBe(15);
  });

  it('recupera respaldo si v9 está corrupto', async () => {
    await AsyncStorage.setItem(PRODUCTIVITY_STORAGE_KEY, '{invalid');
    await AsyncStorage.setItem(
      LEGACY_PRODUCTIVITY_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 7, data: { ...emptyData(), streakCount: 4 } }),
    );

    expect((await loadLocalProductivity()).data.streakCount).toBe(4);
  });

  it('crea mutación CAS con revisión cloud conocida y agrupa por entidad', async () => {
    const cloud = { ...emptyData(), habits: [habit('Cloud')] };
    await replaceLocalProductivity(cloud, {
      'habit:habit-1': cloudMeta(7, JSON.stringify(habit('Cloud'))),
    });

    const first = await persistLocalProductivity({ ...cloud, habits: [habit('Local 1')] });
    const second = await persistLocalProductivity({ ...cloud, habits: [habit('Local 2')] });
    const mutations = second.outbox.filter((item) => item.entityType === 'habit');

    expect(first.outbox.find((item) => item.entityType === 'habit')?.baseServerRevision).toBe(7);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].baseServerRevision).toBe(7);
    expect(mutations[0].payload).toEqual(habit('Local 2'));
  });

  it('rebasa v8 una vez y elimina duplicado por fingerprint', () => {
    const mutation: SyncMutation = {
      mutationId: 'old',
      entityType: 'habit',
      entityId: 'habit-1',
      operation: 'upsert',
      payload: habit(),
      baseServerRevision: 0,
      deviceId: 'old',
      clientUpdatedAt: '2026-08-30T00:00:00.000Z',
      fingerprint: 'same',
    };
    expect(
      rebasePendingMutations([mutation], { 'habit:habit-1': cloudMeta(5, 'same') }, null),
    ).toEqual([]);
    expect(
      rebasePendingMutations([mutation], { 'habit:habit-1': cloudMeta(5, 'other') }, null)[0]
        .baseServerRevision,
    ).toBe(5);
    expect(rebasePendingMutations([{ ...mutation, baseServerRevision: 5 }], {}, null)).toEqual([]);
  });

  it('superpone delete offline y summary pendientes', () => {
    const data = { ...emptyData(), habits: [habit()] };
    const base = {
      baseServerRevision: 2,
      deviceId: 'device',
      clientUpdatedAt: '2026-08-30T00:00:00.000Z',
    };
    const next = applyPendingMutations(data, [
      {
        ...base,
        mutationId: 'delete',
        entityType: 'habit',
        entityId: 'habit-1',
        operation: 'delete',
        payload: null,
        fingerprint: 'deleted',
      },
      {
        ...base,
        mutationId: 'summary',
        entityType: 'summary',
        entityId: 'singleton',
        operation: 'upsert',
        payload: { streakCount: 4, totalXp: 80 },
        fingerprint: 'summary',
      },
    ]);
    expect(next.habits).toEqual([]);
    expect(next).toMatchObject({ streakCount: 4, totalXp: 80 });
  });

  it('limpia v9 y respaldos v8/v7/v6', async () => {
    for (const key of [
      PRODUCTIVITY_STORAGE_KEY,
      LEGACY_PRODUCTIVITY_V8_STORAGE_KEY,
      LEGACY_PRODUCTIVITY_STORAGE_KEY,
      HOME_STATE_KEY,
    ]) {
      await AsyncStorage.setItem(key, 'value');
    }
    await clearLocalProductivity();
    await Promise.all(
      [
        PRODUCTIVITY_STORAGE_KEY,
        LEGACY_PRODUCTIVITY_V8_STORAGE_KEY,
        LEGACY_PRODUCTIVITY_STORAGE_KEY,
        HOME_STATE_KEY,
      ].map(async (key) => {
        expect(await AsyncStorage.getItem(key)).toBeNull();
      }),
    );
  });
});
