import { afterEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const opened: Database.Database[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

async function loadDatabase(old = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "resumer-migration-"));
  dirs.push(dir);
  const filename = path.join(dir, "test.db");
  if (old) {
    const legacy = new Database(filename);
    legacy.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, github_id TEXT UNIQUE NOT NULL);
      CREATE TABLE resumes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT,
        content TEXT, template_id TEXT, theme_variables TEXT);
      INSERT INTO users VALUES ('u', 'dev-u');
      INSERT INTO resumes VALUES ('r', 'u', '旧简历', '原始内容', 'minimal', '{}');`);
    legacy.close();
  }
  vi.stubEnv("DATABASE_URL", filename);
  vi.resetModules();
  const databaseModule = await import("./db");
  expect(fs.existsSync(filename)).toBe(old); // 导入模块不建库
  const db = databaseModule.getDatabase();
  opened.push(db);
  return { db, databaseModule };
}

describe("database initialization", () => {
  it("新库仅在初始化时创建，重复调用复用同一连接", async () => {
    const { db, databaseModule } = await loadDatabase();
    expect(databaseModule.getDatabase()).toBe(db);
    databaseModule.initDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables).toEqual(expect.arrayContaining([
      { name: "users" }, { name: "resumes" }, { name: "photos" }, { name: "resume_versions" }, { name: "rewrite_sessions" },
    ]));
  });
  it("旧库补列并保留内容，不因 parent_id 索引创建顺序失败", async () => {
    const { db } = await loadDatabase(true);
    expect(db.prepare("SELECT content, photo, parent_id, origin_note FROM resumes WHERE id='r'").get())
      .toEqual({ content: "原始内容", photo: null, parent_id: null, origin_note: null });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name='idx_resumes_parent_id'").get()).toBeTruthy();
  });
});
