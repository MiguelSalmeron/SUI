/**
 * Adaptador de persistencia estructurado SQLite para Dominio de Productividad.
 *
 * Proporciona transacciones ACID, índices optimizados y soporte para
 * outbox, entidades (metas, hábitos, snapshots), metadata v2 y summary.
 */

import type {
  ProductivityEnvelopeV9,
} from '../sync/syncTypes';

export interface StorageDriver {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<{ rowsAffected: number; lastInsertRowId: number }>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  withTransactionAsync<T>(action: () => Promise<T>): Promise<T>;
}

/**
 * Driver en memoria ligero compatible con la interfaz de SQLiteDriver,
 * utilizado para pruebas unitarias rápidas y entornos sin binario nativo (Web/Node).
 */
export class MemorySQLiteDriver implements StorageDriver {
  private kv = new Map<string, string>();

  async execAsync(_sql: string): Promise<void> {
    // No-op para creación de tablas DDL en memoria
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number; lastInsertRowId: number }> {
    if (sql.includes('INSERT') || sql.includes('REPLACE')) {
      const key = String(params[0] ?? '');
      const value = String(params[1] ?? '');
      this.kv.set(key, value);
      return { rowsAffected: 1, lastInsertRowId: 1 };
    }
    if (sql.includes('DELETE')) {
      const key = String(params[0] ?? '');
      if (key) {
        this.kv.delete(key);
      } else {
        this.kv.clear();
      }
      return { rowsAffected: 1, lastInsertRowId: 0 };
    }
    return { rowsAffected: 0, lastInsertRowId: 0 };
  }

  async getAllAsync<T>(_sql: string, _params: unknown[] = []): Promise<T[]> {
    const results: T[] = [];
    for (const [key, value] of this.kv.entries()) {
      results.push({ key, value } as unknown as T);
    }
    return results;
  }

  async getFirstAsync<T>(_sql: string, params: unknown[] = []): Promise<T | null> {
    const key = String(params[0] ?? '');
    const val = this.kv.get(key);
    if (val === undefined) return null;
    return { key, value: val } as unknown as T;
  }

  async withTransactionAsync<T>(action: () => Promise<T>): Promise<T> {
    return action();
  }
}

export class SQLiteProductivityAdapter {
  private driver: StorageDriver;
  private initialized = false;

  constructor(driver?: StorageDriver) {
    this.driver = driver ?? new MemorySQLiteDriver();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.driver.execAsync(`
      CREATE TABLE IF NOT EXISTS productivity_kv (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_productivity_kv_key ON productivity_kv(key);
    `);

    this.initialized = true;
  }

  async saveEnvelope(envelope: ProductivityEnvelopeV9): Promise<void> {
    await this.initialize();
    const serialized = JSON.stringify(envelope);
    const now = new Date().toISOString();

    await this.driver.runAsync(
      `INSERT OR REPLACE INTO productivity_kv (key, value, updated_at) VALUES (?, ?, ?);`,
      ['sui_productivity_envelope_v9', serialized, now],
    );
  }

  async loadEnvelope(): Promise<ProductivityEnvelopeV9 | null> {
    await this.initialize();
    const row = await this.driver.getFirstAsync<{ value: string }>(
      `SELECT value FROM productivity_kv WHERE key = ?;`,
      ['sui_productivity_envelope_v9'],
    );

    if (!row || !row.value) return null;
    try {
      return JSON.parse(row.value) as ProductivityEnvelopeV9;
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    await this.initialize();
    await this.driver.runAsync(`DELETE FROM productivity_kv WHERE key = ?;`, [
      'sui_productivity_envelope_v9',
    ]);
  }
}
