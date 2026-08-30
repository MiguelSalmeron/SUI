import AsyncStorage from '@react-native-async-storage/async-storage';
import { HOME_STATE_KEY } from '../model/homeStorage';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('uuid-1'),
}));

import {
  LEGACY_PRODUCTIVITY_STORAGE_KEY,
  PRODUCTIVITY_STORAGE_KEY,
  applyPendingMutations,
  clearLocalProductivity,
  combineProductivity,
  loadLocalProductivity,
  persistLocalProductivity,
  replaceLocalProductivity,
} from '../persistence/productivityRepository';
import type { ProductivityData } from '../sync/syncTypes';

const emptyData = (): ProductivityData => ({
  goals: [],
  habits: [],
  weeklyHistory: [],
  streakCount: 0,
  totalXp: 0,
});

describe('productivity repository', () => {
  beforeEach(async () => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
  });

  it('migra storage v6 hacia v8 sin borrar datos existentes', async () => {
    await AsyncStorage.setItem(
      HOME_STATE_KEY,
      JSON.stringify({
        goals: [
          {
            id: 'goal-1',
            title: 'Meta guardada',
            deadline: '2026-09-01',
            progress: 0,
            milestones: [],
            completed: false,
            gravity: 'low',
            createdAt: '2026-08-27',
          },
        ],
        habits: [],
        streakCount: 2,
        weeklyHistory: [],
        totalXp: 10,
      }),
    );

    const envelope = await loadLocalProductivity();
    expect(envelope.schemaVersion).toBe(8);
    expect(envelope.data.goals[0].title).toBe('Meta guardada');
    expect(await AsyncStorage.getItem(PRODUCTIVITY_STORAGE_KEY)).not.toBeNull();
  });

  it('migra v7 hacia nueva key y conserva respaldo intacto', async () => {
    const legacy = {
      schemaVersion: 7,
      data: { ...emptyData(), streakCount: 4 },
      metadata: {},
      outbox: [],
      lastSyncedAt: '2026-08-29T00:00:00.000Z',
    };
    await AsyncStorage.setItem(LEGACY_PRODUCTIVITY_STORAGE_KEY, JSON.stringify(legacy));

    const envelope = await loadLocalProductivity();

    expect(envelope.schemaVersion).toBe(8);
    expect(envelope.data.streakCount).toBe(4);
    expect(await AsyncStorage.getItem(LEGACY_PRODUCTIVITY_STORAGE_KEY)).toBe(
      JSON.stringify(legacy),
    );
  });

  it('recupera respaldo cuando v8 está corrupto', async () => {
    await AsyncStorage.setItem(PRODUCTIVITY_STORAGE_KEY, '{invalid');
    await AsyncStorage.setItem(
      LEGACY_PRODUCTIVITY_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 7, data: { ...emptyData(), totalXp: 25 } }),
    );

    const envelope = await loadLocalProductivity();

    expect(envelope.data.totalXp).toBe(25);
  });

  it('descarta v7 estructuralmente corrupto y migra v6 válido', async () => {
    await AsyncStorage.setItem(
      LEGACY_PRODUCTIVITY_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 7, data: { ...emptyData(), goals: 'invalid' } }),
    );
    await AsyncStorage.setItem(HOME_STATE_KEY, JSON.stringify({ ...emptyData(), totalXp: 15 }));

    const envelope = await loadLocalProductivity();

    expect(envelope.data.totalXp).toBe(15);
    expect(envelope.data.goals).toEqual([]);
  });

  it('inicia vacío sin sembrar metas, hábitos ni XP', async () => {
    const envelope = await loadLocalProductivity();
    expect(envelope.data).toEqual(emptyData());
    expect(envelope.outbox).toEqual([]);
  });

  it('crea outbox persistente para entidad y resumen', async () => {
    const data = emptyData();
    data.habits.push({
      id: 'habit-1',
      title: 'Caminar',
      completed: false,
      frequency: 'daily',
      streak: 0,
      createdAt: '2026-08-27',
    });
    const envelope = await persistLocalProductivity(data);
    expect(envelope.outbox.map((mutation) => mutation.entityType).sort()).toEqual([
      'habit',
      'summary',
    ]);
  });

  it('incrementa revisión cloud al conservar cambio local durante fusión', async () => {
    const cloud = emptyData();
    cloud.habits = [
      {
        id: 'habit-1',
        title: 'Cloud',
        completed: false,
        frequency: 'daily',
        streak: 0,
        createdAt: '2026-08-27',
      },
    ];
    await replaceLocalProductivity(cloud, {
      'habit:habit-1': {
        schemaVersion: 1,
        updatedAt: '2026-08-29T00:00:00.000Z',
        revision: 3,
        deviceId: 'device-cloud',
        fingerprint: JSON.stringify(cloud.habits[0]),
      },
    });
    const combined = emptyData();
    combined.habits = [{ ...cloud.habits[0], title: 'Local' }];

    const envelope = await persistLocalProductivity(combined);
    const mutation = envelope.outbox.find((item) => item.entityType === 'habit');

    expect(mutation?.meta.revision).toBe(4);
    expect(mutation?.payload).toEqual(combined.habits[0]);
  });

  it('elimina v8 y respaldos al limpiar productividad', async () => {
    await AsyncStorage.setItem(PRODUCTIVITY_STORAGE_KEY, 'v8');
    await AsyncStorage.setItem(LEGACY_PRODUCTIVITY_STORAGE_KEY, 'v7');
    await AsyncStorage.setItem(HOME_STATE_KEY, 'v6');

    await clearLocalProductivity();

    expect(await AsyncStorage.getItem(PRODUCTIVITY_STORAGE_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(LEGACY_PRODUCTIVITY_STORAGE_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(HOME_STATE_KEY)).toBeNull();
  });

  it('combina IDs sin duplicar y conserva cambio local', () => {
    const local = emptyData();
    const cloud = emptyData();
    local.habits = [
      {
        id: 'same',
        title: 'Local',
        completed: false,
        frequency: 'daily',
        streak: 1,
        createdAt: '2026-08-27',
      },
    ];
    cloud.habits = [
      {
        id: 'same',
        title: 'Cloud',
        completed: false,
        frequency: 'daily',
        streak: 2,
        createdAt: '2026-08-26',
      },
    ];
    expect(combineProductivity(local, cloud).habits).toEqual(local.habits);
  });

  it('aplica tombstone y resumen pendientes sobre pull remoto', () => {
    const cloud = emptyData();
    cloud.habits = [
      {
        id: 'habit-1',
        title: 'Remoto',
        completed: false,
        frequency: 'daily',
        streak: 0,
        createdAt: '2026-08-27',
      },
    ];
    const meta = {
      schemaVersion: 1 as const,
      updatedAt: '2026-08-30T00:00:00.000Z',
      revision: 2,
      deviceId: 'device-z',
      fingerprint: 'deleted',
      deletedAt: '2026-08-30T00:00:00.000Z',
    };

    const next = applyPendingMutations(cloud, [
      {
        mutationId: 'delete-habit',
        entityType: 'habit',
        entityId: 'habit-1',
        operation: 'delete',
        payload: null,
        meta,
      },
      {
        mutationId: 'summary',
        entityType: 'summary',
        entityId: 'singleton',
        operation: 'upsert',
        payload: { streakCount: 4, totalXp: 80 },
        meta: { ...meta, fingerprint: 'summary', deletedAt: undefined },
      },
    ]);

    expect(next.habits).toEqual([]);
    expect(next.streakCount).toBe(4);
    expect(next.totalXp).toBe(80);
  });
});
