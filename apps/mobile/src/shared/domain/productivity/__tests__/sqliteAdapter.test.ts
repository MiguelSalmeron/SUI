import { SQLiteProductivityAdapter, MemorySQLiteDriver } from '../persistence/sqliteAdapter';
import { migrateV9ToSQLite } from '../persistence/migrationV9toSQLite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRODUCTIVITY_STORAGE_KEY } from '../persistence/productivityRepository';
import type { ProductivityEnvelopeV9 } from '../sync/syncTypes';

describe('SQLiteProductivityAdapter & Migration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('saves, loads, and clears envelope correctly in SQLite adapter', async () => {
    const driver = new MemorySQLiteDriver();
    const adapter = new SQLiteProductivityAdapter(driver);

    const envelope: ProductivityEnvelopeV9 = {
      schemaVersion: 9,
      data: {
        goals: [
          {
            id: 'g-1',
            title: 'Objetivo de prueba',
            deadline: '2026-12-31',
            progress: 50,
            milestones: [],
            completed: false,
            gravity: 'high',
            createdAt: '2026-09-01T00:00:00.000Z',
          },
        ],
        habits: [
          {
            id: 'h-1',
            title: 'Hábito diario',
            completed: true,
            frequency: 'daily',
            streak: 3,
            createdAt: '2026-09-01T00:00:00.000Z',
          },
        ],
        weeklyHistory: [],
        streakCount: 3,
        totalXp: 150,
      },
      metadata: {},
      summaryMeta: null,
      outbox: [],
      pullState: {
        syncEpoch: 0,
        cursors: { goals: null, habits: null, snapshots: null },
        needsBootstrap: false,
        needsRebase: false,
      },
      lastSyncedAt: null,
    };

    await adapter.saveEnvelope(envelope);
    const loaded = await adapter.loadEnvelope();
    expect(loaded).toEqual(envelope);

    await adapter.clear();
    const afterClear = await adapter.loadEnvelope();
    expect(afterClear).toBeNull();
  });

  it('migrates from AsyncStorage v9 to SQLite adapter seamlessly', async () => {
    const driver = new MemorySQLiteDriver();
    const adapter = new SQLiteProductivityAdapter(driver);

    const v9Data: ProductivityEnvelopeV9 = {
      schemaVersion: 9,
      data: {
        goals: [],
        habits: [
          {
            id: 'h-migrate',
            title: 'Lectura diaria',
            completed: false,
            frequency: 'daily',
            streak: 1,
            createdAt: '2026-09-01T00:00:00.000Z',
          },
        ],
        weeklyHistory: [],
        streakCount: 1,
        totalXp: 50,
      },
      metadata: {},
      summaryMeta: null,
      outbox: [],
      pullState: {
        syncEpoch: null,
        cursors: { goals: null, habits: null, snapshots: null },
        needsBootstrap: true,
        needsRebase: false,
      },
      lastSyncedAt: null,
    };

    await AsyncStorage.setItem(PRODUCTIVITY_STORAGE_KEY, JSON.stringify(v9Data));

    const result = await migrateV9ToSQLite(adapter);
    expect(result.migrated).toBe(true);
    expect(result.habitsCount).toBe(1);

    const loaded = await adapter.loadEnvelope();
    expect(loaded?.data.habits[0]?.id).toBe('h-migrate');

    // Second run should detect already migrated
    const secondRun = await migrateV9ToSQLite(adapter);
    expect(secondRun.migrated).toBe(false);
    expect(secondRun.reason).toBe('already_migrated');
  });
});
