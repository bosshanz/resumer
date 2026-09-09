import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { ensureRewriteSessionsTable } from "./rewrite/sessions";
import { ensureResumeVersionsTable } from "./resume-versions";
import { ensurePhotosTable, migrateLegacyPhotos } from "./photos";

let db: Database.Database | null = null;
let migrated = false;

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

// 迁移靠 ALTER TABLE 补列，重复执行必然撞“列已存在”。只有这一类错误可以吞掉；
// 磁盘满、权限不足等真实故障必须向上抛，不能伪装成“列已存在”
function isDuplicateColumnError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as NodeJS.ErrnoException).code === "SQLITE_ERROR" &&
    /duplicate column name/i.test(error.message)
  );
}

function addColumn(database: Database.Database, table: string, column: string, decl: string): void {
  try {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  } catch (error) {
    if (!isDuplicateColumnError(error)) throw error;
  }
}

function migrate(database: Database.Database): void {
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
      parent_id TEXT,
      origin_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
  `);
  ensureRewriteSessionsTable(database);
  ensureResumeVersionsTable(database);
  ensurePhotosTable(database);

  // 迁移：变体溯源（改写另存/手动复制 → 母本）
  // 索引必须在列存在之后创建：老库先走 addColumn，新库建表时已带列
  addColumn(database, "resumes", "photo", "TEXT");
  addColumn(database, "resumes", "parent_id", "TEXT");
  addColumn(database, "resumes", "origin_note", "TEXT");
  database.exec(`CREATE INDEX IF NOT EXISTS idx_resumes_parent_id ON resumes(parent_id)`);

  migrateLegacyPhotos(database);
}

// 首次调用时建库并跑迁移，之后是廉价的单例读取。
// 路由与回调在请求期调用它，模块加载期不再有副作用；启动预热见根目录 instrumentation.ts
export function getDatabase(): Database.Database {
  if (!db) {
    db = createDb();
  }
  if (!migrated) {
    migrate(db);
    migrated = true;
  }
  return db;
}

export function initDb() {
  getDatabase();
}

export { db as _db };
