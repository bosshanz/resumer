import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  ensurePhotosTable,
  isPhotoRef,
  migrateLegacyPhotos,
  photoRef,
  pruneOrphanPhotos,
  resolvePhoto,
  resolveResumePhoto,
} from "./photos";

const PNG_A = "data:image/png;base64,AAAA";
const PNG_B = "data:image/png;base64,BBBB";

function setup() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE resumes (
      id TEXT PRIMARY KEY,
      title TEXT,
      photo TEXT
    );
    CREATE TABLE resume_versions (
      id TEXT PRIMARY KEY,
      resume_id TEXT,
      photo TEXT
    );
  `);
  ensurePhotosTable(db);
  return db;
}

describe("photoRef / resolvePhoto", () => {
  it("相同内容只存一份，引用指向同一哈希", () => {
    const db = setup();
    const ref1 = photoRef(db, PNG_A);
    const ref2 = photoRef(db, PNG_A);

    expect(ref1).toBe(ref2);
    expect(isPhotoRef(ref1)).toBe(true);
    const count = db.prepare(`SELECT COUNT(*) as n FROM photos`).get() as { n: number };
    expect(count.n).toBe(1);
  });

  it("引用可还原为 data URL，未知引用按无照片处理", () => {
    const db = setup();
    const ref = photoRef(db, PNG_A);

    expect(resolvePhoto(db, ref)).toBe(PNG_A);
    expect(resolvePhoto(db, "hash:deadbeef")).toBeUndefined();
    expect(resolvePhoto(db, null)).toBeUndefined();
    expect(resolvePhoto(db, "")).toBeUndefined();
  });

  it("裸 data URL（未迁移数据）原样返回", () => {
    const db = setup();
    expect(resolvePhoto(db, PNG_B)).toBe(PNG_B);
  });

  it("resolveResumePhoto 返回带已解析照片的副本", () => {
    const db = setup();
    const ref = photoRef(db, PNG_A);
    const resume = { title: "张三", photo: ref };

    expect(resolveResumePhoto(db, resume)).toEqual({ title: "张三", photo: PNG_A });
    expect(resume.photo).toBe(ref); // 不改写入参
  });
});

describe("migrateLegacyPhotos", () => {
  it("把历史 data URL 行转为引用并去重", () => {
    const db = setup();
    db.prepare(`INSERT INTO resumes (id, photo) VALUES ('r1', ?)`).run(PNG_A);
    db.prepare(`INSERT INTO resume_versions (id, resume_id, photo) VALUES ('v1', 'r1', ?)`).run(PNG_A);
    db.prepare(`INSERT INTO resumes (id, photo) VALUES ('r2', NULL)`).run();

    migrateLegacyPhotos(db);

    const resumed = db.prepare(`SELECT photo FROM resumes WHERE id = 'r1'`).get() as { photo: string };
    const versioned = db.prepare(`SELECT photo FROM resume_versions WHERE id = 'v1'`).get() as { photo: string };
    expect(resumed.photo).toBe(versioned.photo); // 同一张照片共享同一引用
    expect(resolvePhoto(db, resumed.photo)).toBe(PNG_A);

    migrateLegacyPhotos(db); // 幂等
    const count = db.prepare(`SELECT COUNT(*) as n FROM photos`).get() as { n: number };
    expect(count.n).toBe(1);
  });
});

describe("pruneOrphanPhotos", () => {
  it("删除无引用照片，保留简历或快照仍引用的照片", () => {
    const db = setup();
    const keptByResume = photoRef(db, PNG_A);
    const keptByVersion = photoRef(db, PNG_B);
    photoRef(db, "data:image/png;base64,ORPHAN");

    db.prepare(`INSERT INTO resumes (id, photo) VALUES ('r1', ?)`).run(keptByResume);
    db.prepare(`INSERT INTO resume_versions (id, resume_id, photo) VALUES ('v1', 'r1', ?)`).run(keptByVersion);

    pruneOrphanPhotos(db);

    const remaining = db.prepare(`SELECT ref FROM photos`).all() as { ref: string }[];
    expect(remaining).toHaveLength(2);
    expect(resolvePhoto(db, keptByResume)).toBe(PNG_A);
    expect(resolvePhoto(db, keptByVersion)).toBe(PNG_B);
  });
});
