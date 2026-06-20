import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db: Database.Database | null = null;

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || "./data/resumer.db";
  return path.isAbsolute(dbUrl)
    ? dbUrl
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), dbUrl);
}

function createDb(): Database.Database {
  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  return database;
}

export function getDatabase(): Database.Database {
  if (!db) {
    db = createDb();
  }
  return db;
}

export function initDb() {
  const database = getDatabase();
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      github_id TEXT UNIQUE NOT NULL,
      email TEXT,
      name TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '未命名简历',
      content TEXT NOT NULL DEFAULT '',
      template_id TEXT NOT NULL DEFAULT 'minimal',
      theme_variables TEXT NOT NULL DEFAULT '{}',
      photo TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
  `);

  // Migration: add photo column to existing databases
  try {
    database.exec(`ALTER TABLE resumes ADD COLUMN photo TEXT`);
  } catch {
    // Column already exists
  }
}

export { db as _db };
