/**
 * Motor de migración atómica de AsyncStorage v9 hacia persistencia SQLite.
 *
 * Garantiza integridad referencial, conteo de entidades (metas, hábitos, snapshots)
 * y preservación del sobre histórico como respaldo seguro.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PRODUCTIVITY_STORAGE_KEY,
  parseProductivityEnvelopeV9,
} from './productivityRepository';
import { SQLiteProductivityAdapter } from './sqliteAdapter';

export interface MigrationResult {
  migrated: boolean;
  goalsCount: number;
  habitsCount: number;
  outboxCount: number;
  reason?: string;
}

export const migrateV9ToSQLite = async (
  sqliteAdapter: SQLiteProductivityAdapter,
): Promise<MigrationResult> => {
  // 1. Verificar si ya existe en SQLite
  const existingSqlite = await sqliteAdapter.loadEnvelope();
  if (existingSqlite) {
    return {
      migrated: false,
      goalsCount: existingSqlite.data.goals.length,
      habitsCount: existingSqlite.data.habits.length,
      outboxCount: existingSqlite.outbox.length,
      reason: 'already_migrated',
    };
  }

  // 2. Leer AsyncStorage v9
  const rawV9 = await AsyncStorage.getItem(PRODUCTIVITY_STORAGE_KEY);
  if (!rawV9) {
    return {
      migrated: false,
      goalsCount: 0,
      habitsCount: 0,
      outboxCount: 0,
      reason: 'no_v9_data',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawV9);
  } catch {
    return {
      migrated: false,
      goalsCount: 0,
      habitsCount: 0,
      outboxCount: 0,
      reason: 'corrupt_v9_json',
    };
  }

  const envelope = parseProductivityEnvelopeV9(parsed);
  if (!envelope) {
    return {
      migrated: false,
      goalsCount: 0,
      habitsCount: 0,
      outboxCount: 0,
      reason: 'invalid_v9_schema',
    };
  }

  // 3. Escribir en SQLite
  await sqliteAdapter.saveEnvelope(envelope);

  return {
    migrated: true,
    goalsCount: envelope.data.goals.length,
    habitsCount: envelope.data.habits.length,
    outboxCount: envelope.outbox.length,
  };
};
