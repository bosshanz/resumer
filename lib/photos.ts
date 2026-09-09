import type Database from "better-sqlite3";
import crypto from "crypto";

// 照片按内容寻址去重：resumes.photo / resume_versions.photo 里存的是 `hash:<sha256>` 引用，
// 真正的 data URL 只在 photos 表存一份。否则每份简历的 20 份历史快照会各自携带最多 2MB 图片。
// photos 表直接以完整引用串为主键，回收时与引用列逐字比对；读写边界见 photoRef / resolvePhoto。
export const PHOTO_REF_PREFIX = "hash:";

export function ensurePhotosTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      ref TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function photoHash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function isPhotoRef(value: string): boolean {
  return value.startsWith(PHOTO_REF_PREFIX);
}

// 写入路径：data URL → 引用；相同内容只落一行
export function photoRef(db: Database.Database, data: string): string {
  const ref = `${PHOTO_REF_PREFIX}${photoHash(data)}`;
  db.prepare(`INSERT OR IGNORE INTO photos (ref, data) VALUES (?, ?)`).run(ref, data);
  return ref;
}

// 读取路径：引用 → data URL；裸 data URL（未迁移的老数据）原样返回；
// 引用悬空（照片行被清理）按“无照片”处理
export function resolvePhoto(db: Database.Database, value?: string | null): string | undefined {
  if (!value) return undefined;
  if (!isPhotoRef(value)) return value;
  const row = db.prepare(`SELECT data FROM photos WHERE ref = ?`).get(value) as
    | { data: string }
    | undefined;
  return row ? row.data : undefined;
}

export function resolveResumePhoto<T extends { photo?: string }>(
  db: Database.Database,
  resume: T | null
): T | null {
  return resume ? { ...resume, photo: resolvePhoto(db, resume.photo) } : null;
}

// 引用来源只有 resumes 和 resume_versions 两张表；本地单用户规模下全表扫描成本可忽略
export function pruneOrphanPhotos(db: Database.Database): void {
  db.prepare(
    `
    DELETE FROM photos WHERE ref NOT IN (
      SELECT photo FROM resumes WHERE photo IS NOT NULL
    ) AND ref NOT IN (
      SELECT photo FROM resume_versions WHERE photo IS NOT NULL
    )
    `
  ).run();
}

// 一次性迁移：把仍然直接存 data URL 的行转为引用。幂等，重复执行无效果。
export function migrateLegacyPhotos(db: Database.Database): void {
  const likeEscaped = `${PHOTO_REF_PREFIX}%`;
  const legacyResumes = db
    .prepare(
      `SELECT id, photo FROM resumes
       WHERE photo IS NOT NULL AND photo != '' AND photo NOT LIKE ?`
    )
    .all(likeEscaped) as { id: string; photo: string }[];
  const legacyVersions = db
    .prepare(
      `SELECT id, photo FROM resume_versions
       WHERE photo IS NOT NULL AND photo != '' AND photo NOT LIKE ?`
    )
    .all(likeEscaped) as { id: string; photo: string }[];

  if (legacyResumes.length === 0 && legacyVersions.length === 0) return;

  const convert = db.transaction(() => {
    for (const row of legacyResumes) {
      db.prepare(`UPDATE resumes SET photo = ? WHERE id = ?`).run(photoRef(db, row.photo), row.id);
    }
    for (const row of legacyVersions) {
      db.prepare(`UPDATE resume_versions SET photo = ? WHERE id = ?`).run(photoRef(db, row.photo), row.id);
    }
  });
  convert();
}
