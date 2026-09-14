import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DB_DIR = process.env.VERCEL
  ? path.join('/tmp', 'stockpilot_data')
  : path.join(process.cwd(), 'src', 'data');

try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create DB_DIR, will fallback to :memory: if needed', e);
}

const DB_PATH = process.env.VERCEL
  ? path.join('/tmp', 'stockpilot_data', 'stockpilot.db')
  : path.join(DB_DIR, 'stockpilot.db');

// Global singleton to reuse DB connection across Next.js API requests
const globalForDb = globalThis as unknown as {
  stockpilotDb?: DatabaseSync;
};

export function getDatabase(): DatabaseSync {
  if (!globalForDb.stockpilotDb) {
    let db: DatabaseSync;
    try {
      db = new DatabaseSync(DB_PATH);
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA foreign_keys = ON;');
    } catch (err) {
      console.warn('Falling back to in-memory SQLite database on serverless:', err);
      db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');
    }

    // Auto-migrate tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        hashed_id TEXT PRIMARY KEY,
        auth_provider TEXT NOT NULL,
        display_name TEXT,
        created_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL,
        settings_json TEXT
      );

      CREATE TABLE IF NOT EXISTS custom_strategies (
        id TEXT PRIMARY KEY,
        user_hashed_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        target_weights_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_hashed_id) REFERENCES users(hashed_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        user_hashed_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        asset TEXT NOT NULL,
        amount REAL NOT NULL,
        tx_signature TEXT,
        reason TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_hashed_id) REFERENCES users(hashed_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id TEXT PRIMARY KEY,
        user_hashed_id TEXT NOT NULL,
        total_value_usdc REAL NOT NULL,
        holdings_json TEXT,
        snapshot_at INTEGER NOT NULL,
        FOREIGN KEY (user_hashed_id) REFERENCES users(hashed_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_strategies_user ON custom_strategies(user_hashed_id);
      CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_hashed_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_user ON portfolio_snapshots(user_hashed_id);
    `);

    globalForDb.stockpilotDb = db;
  }

  return globalForDb.stockpilotDb;
}
