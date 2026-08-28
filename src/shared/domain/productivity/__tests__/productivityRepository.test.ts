import AsyncStorage from '@react-native-async-storage/async-storage';
import { HOME_STATE_KEY } from '../homeStorage';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('uuid-1'),
}));

jest.mock('../userData', () => ({
  applyCloudMutations: jest.fn(async () => undefined),
  loadCloudProductivity: jest.fn(async () => null),
}));

import {
  PRODUCTIVITY_STORAGE_KEY,
  combineProductivity,
  loadLocalProductivity,
  persistLocalProductivity,
} from '../productivityRepository';
import type { ProductivityData } from '../syncTypes';

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

  it('migra storage v6 sin borrar datos existentes', async () => {
    await AsyncStorage.setItem(HOME_STATE_KEY, JSON.stringify({
      goals: [{
        id: 'goal-1',
        title: 'Meta guardada',
        deadline: '2026-09-01',
        progress: 0,
        milestones: [],
        completed: false,
        gravity: 'low',
        createdAt: '2026-08-27',
      }],
      habits: [],
      streakCount: 2,
      weeklyHistory: [],
      totalXp: 10,
    }));

    const envelope = await loadLocalProductivity();
    expect(envelope.schemaVersion).toBe(7);
    expect(envelope.data.goals[0].title).toBe('Meta guardada');
    expect(await AsyncStorage.getItem(PRODUCTIVITY_STORAGE_KEY)).not.toBeNull();
  });

  it('inicia vacío sin sembrar metas, hábitos ni XP', async () => {
    const envelope = await loadLocalProductivity();
    expect(envelope.data).toEqual(emptyData());
    expect(envelope.outbox).toEqual([]);
  });

  it('crea outbox persistente sólo al confirmar una entidad', async () => {
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
    expect(envelope.outbox).toHaveLength(1);
    expect(envelope.outbox[0]).toMatchObject({
      entityType: 'habit',
      entityId: 'habit-1',
      operation: 'upsert',
    });
  });

  it('combina IDs sin duplicar y conserva cambio local', () => {
    const local = emptyData();
    const cloud = emptyData();
    local.habits = [{
      id: 'same', title: 'Local', completed: false, frequency: 'daily', streak: 1, createdAt: '2026-08-27',
    }];
    cloud.habits = [{
      id: 'same', title: 'Cloud', completed: false, frequency: 'daily', streak: 2, createdAt: '2026-08-26',
    }];
    expect(combineProductivity(local, cloud).habits).toEqual(local.habits);
  });
});
