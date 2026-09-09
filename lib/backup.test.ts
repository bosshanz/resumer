import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { exportBackup, restoreBackup } from "./backup";
import { MAX_BACKUP_BYTES, parseBackup } from "./backup-format";
import { ensurePhotosTable, photoRef, resolvePhoto } from "./photos";
import { ensureResumeVersionsTable } from "./resume-versions";

let db: Database.Database;
let userId: string | null = "alice";
vi.mock("next-auth/next", () => ({ getServerSession: async () => userId ? { user: { id: userId } } : null }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ getDatabase: () => db }));
import { GET, POST } from "../app/api/backup/route";
import { PATCH } from "../app/api/resumes/[id]/route";
import { POST as restoreVersion } from "../app/api/resumes/[id]/versions/[versionId]/restore/route";

const photo = "data:image/png;base64,AAAA";
const oldPhoto = "data:image/png;base64,BBBB";
const request = (value: unknown) => new Request("http://localhost/api/backup", {
  method: "POST", body: JSON.stringify(value), headers: { "Content-Type": "application/json" },
});

beforeEach(() => {
  userId = "alice";
  db = new Database(":memory:");
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY);
    INSERT INTO users VALUES ('alice'), ('bob');
    CREATE TABLE resumes (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
      content TEXT NOT NULL, template_id TEXT NOT NULL, theme_variables TEXT NOT NULL,
      photo TEXT, parent_id TEXT, origin_note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    INSERT INTO resumes (id, user_id, title, content, template_id, theme_variables, parent_id, origin_note)
    VALUES ('root', 'alice', '母本', '原文<!-- hidden -->', 'minimal', '{"collectionVersion":2}', NULL, NULL),
      ('variant', 'alice', '变体', '改写正文', 'ledger', '{}', 'root', '岗位 A'),
      ('private', 'bob', '其他账户', '不导出', 'minimal', '{}', NULL, NULL);`);
  ensurePhotosTable(db);
  ensureResumeVersionsTable(db);
  const ref = photoRef(db, photo);
  db.prepare("UPDATE resumes SET photo = ? WHERE user_id = 'alice'").run(ref);
  const versionPhoto = photoRef(db, oldPhoto);
  db.prepare(`INSERT INTO resume_versions
    (id, resume_id, user_id, title, content, template_id, theme_variables, photo, created_at)
    VALUES ('v1', 'root', 'alice', '旧版', '历史正文', 'editorial', '{}', ?, '2026-01-01 00:00:00')`).run(versionPhoto);
  photoRef(db, "data:image/png;base64,PRIVATE");
});
afterEach(() => db.close());

describe("portable backups", () => {
  it("仅导出本人数据、引用照片，完整恢复历史、样式与母本关系", () => {
    const backup = exportBackup(db, "alice");
    expect(backup.resumes).toHaveLength(2);
    expect(backup.photos).toHaveLength(2);
    expect(JSON.stringify(backup)).not.toContain("user_id");
    expect(JSON.stringify(backup)).not.toContain("PRIVATE");
    expect(restoreBackup(db, "bob", backup)).toEqual({ resumes: 2, versions: 1 });
    const restored = exportBackup(db, "bob");
    const root = restored.resumes.find((r) => r.title === "母本")!;
    const variant = restored.resumes.find((r) => r.title === "变体")!;
    expect(root.id).not.toBe("root");
    expect(root.content).toBe(backup.resumes[0].content);
    expect(root.theme_variables).toBe(backup.resumes[0].theme_variables);
    expect(root.created_at).toBe(backup.resumes[0].created_at);
    expect(variant.parent_id).toBe(root.id);
    expect(variant.origin_note).toBe("岗位 A");
    expect(restored.versions[0]).toMatchObject({ resume_id: root.id, content: "历史正文", created_at: "2026-01-01 00:00:00" });
    expect(resolvePhoto(db, restored.versions[0].photo)).toBe(oldPhoto);
    expect(exportBackup(db, "alice")).toMatchObject({ resumes: backup.resumes, versions: backup.versions });
  });

  it("重复恢复新增副本，不覆盖原简历或重复存储照片", () => {
    const backup = exportBackup(db, "alice");
    restoreBackup(db, "alice", backup);
    restoreBackup(db, "alice", backup);
    expect(exportBackup(db, "alice").resumes).toHaveLength(6);
    expect(db.prepare("SELECT count(*) n FROM photos").get()).toEqual({ n: 3 });
  });

  it("拒绝未知版本、重复 ID、缺失引用、循环母本和损坏照片", () => {
    const backup = exportBackup(db, "alice");
    expect(() => parseBackup({ ...backup, version: 2 })).toThrow();
    expect(() => parseBackup({ ...backup, resumes: [...backup.resumes, backup.resumes[0]] })).toThrow(/重复/);
    expect(() => parseBackup({ ...backup, photos: [] })).toThrow(/照片/);
    expect(() => parseBackup({ ...backup, resumes: [] })).toThrow(/对应简历/);
    const cyclic = structuredClone(backup);
    cyclic.resumes[0].parent_id = "variant";
    expect(() => parseBackup(cyclic)).toThrow(/循环/);
    const damaged = structuredClone(backup);
    damaged.photos[0].data += "corruption";
    expect(() => restoreBackup(db, "alice", damaged)).toThrow(/校验/);
    expect(exportBackup(db, "alice").resumes).toHaveLength(2);
  });

  it("中途写入失败时连同照片和简历一起回滚", () => {
    const backup = exportBackup(db, "alice");
    db.exec("DELETE FROM resume_versions; DELETE FROM resumes; DELETE FROM photos;");
    db.exec(`CREATE TRIGGER fail_version BEFORE INSERT ON resume_versions BEGIN
      SELECT RAISE(ABORT, 'simulated disk error'); END;`);
    expect(() => restoreBackup(db, "alice", backup)).toThrow("simulated disk error");
    expect(db.prepare("SELECT count(*) n FROM resumes").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT count(*) n FROM photos").get()).toEqual({ n: 0 });
  });

  it("母本已删除时不会连接到目标账户的同 ID 简历", () => {
    db.exec("UPDATE resumes SET parent_id = 'private' WHERE id = 'variant'");
    restoreBackup(db, "bob", exportBackup(db, "alice"));
    const variant = exportBackup(db, "bob").resumes.find((r) => r.title === "变体")!;
    expect(variant.parent_id).not.toBe("private");
    expect(variant.parent_id).toBeTruthy();
  });
});

describe("backup HTTP boundary", () => {
  it("未登录不可导出或恢复", async () => {
    userId = null;
    expect((await GET()).status).toBe(401);
    expect((await POST(request({}))).status).toBe(401);
  });
  it("下载 JSON 可直接恢复，设置附件与禁止缓存", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const imported = await POST(request(await response.json()));
    expect(imported.status).toBe(201);
    expect(await imported.json()).toEqual({ restored: { resumes: 2, versions: 1 } });
  });
  it("无效 JSON 与超限文件均被拒绝", async () => {
    const bad = new Request("http://localhost/api/backup", { method: "POST", body: "{" });
    expect((await POST(bad)).status).toBe(400);
    const large = request({});
    large.headers.set("content-length", String(MAX_BACKUP_BYTES + 1));
    expect((await POST(large)).status).toBe(413);
  });
});

describe("photo and snapshot closeout", () => {
  const patch = (value: unknown) => PATCH(request(value), { params: Promise.resolve({ id: "root" }) });
  it("仅手动留档请求也会创建快照", async () => {
    expect((await patch({ snapshot: true })).status).toBe(200);
    expect(exportBackup(db, "alice").versions).toHaveLength(2);
  });
  it("未到留档间隔也回收被替换的无引用图片", async () => {
    await patch({ snapshot: true });
    await patch({ photo: "data:image/png;base64,CCCC" });
    const intermediate = exportBackup(db, "alice").resumes.find((r) => r.id === "root")!.photo;
    await patch({ photo: "data:image/png;base64,DDDD" });
    expect(resolvePhoto(db, intermediate)).toBeUndefined();
    expect(resolvePhoto(db, exportBackup(db, "alice").versions[0].photo)).toBe(oldPhoto);
  });
  it("快照失败不留下部分保存或孤儿照片", async () => {
    const before = exportBackup(db, "alice");
    db.exec(`CREATE TRIGGER fail_snapshot BEFORE INSERT ON resume_versions BEGIN SELECT RAISE(ABORT, 'snapshot failed'); END;`);
    await expect(patch({ title: "不能半写入", photo: "data:image/png;base64,CCCC", snapshot: true })).rejects.toThrow();
    expect(exportBackup(db, "alice")).toMatchObject({ resumes: before.resumes, versions: before.versions });
    expect(db.prepare("SELECT count(*) n FROM photos").get()).toEqual({ n: 3 });
  });
  it("恢复旧版后返回真实照片，并先保存当前状态", async () => {
    const response = await restoreVersion(request({}), { params: Promise.resolve({ id: "root", versionId: "v1" }) });
    expect(response.status).toBe(200);
    expect((await response.json()).resume.photo).toBe(oldPhoto);
    expect(exportBackup(db, "alice").versions).toHaveLength(2);
  });
});
