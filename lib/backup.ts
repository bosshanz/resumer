import type Database from "better-sqlite3";
import crypto from "crypto";
import { BackupError, parseBackup, type ResumeBackup } from "./backup-format";
import { photoRef, resolvePhoto } from "./photos";

const stateColumns = "title, content, template_id, theme_variables, photo, created_at";

// 同一读事务获得一致快照；导出只包含当前账户及其实际引用的照片。
export function exportBackup(db: Database.Database, userId: string): ResumeBackup {
  return db.transaction(() => {
    const resumes = db.prepare(`SELECT id, ${stateColumns}, parent_id, origin_note, updated_at
      FROM resumes WHERE user_id = ? ORDER BY rowid`).all(userId) as ResumeBackup["resumes"];
    const versions = db.prepare(`SELECT id, resume_id, ${stateColumns}
      FROM resume_versions WHERE user_id = ? AND resume_id IN
      (SELECT id FROM resumes WHERE user_id = ?) ORDER BY rowid`).all(userId, userId) as ResumeBackup["versions"];
    const photos = new Map<string, string>();
    for (const row of [...resumes, ...versions]) {
      if (!row.photo) { row.photo = null; continue; }
      const data = resolvePhoto(db, row.photo);
      if (!data) throw new BackupError("有照片数据缺失，备份未生成，请先修复原始数据", 409);
      const ref = `hash:${crypto.createHash("sha256").update(data).digest("hex")}`;
      photos.set(ref, data);
      row.photo = ref;
    }
    return parseBackup({
      format: "resumer-backup", version: 1, createdAt: new Date().toISOString(),
      resumes, versions, photos: [...photos].map(([ref, data]) => ({ ref, data })),
    });
  })();
}

// 全部验证后一次性写入，重新分配 ID；失败回滚，已有简历保持原样。
export function restoreBackup(db: Database.Database, userId: string, value: unknown) {
  const backup = parseBackup(value);
  for (const photo of backup.photos) {
    const expected = `hash:${crypto.createHash("sha256").update(photo.data).digest("hex")}`;
    if (photo.ref !== expected) throw new BackupError("照片校验失败，备份可能已损坏");
  }
  return db.transaction(() => {
    if (!db.prepare("SELECT id FROM users WHERE id = ?").get(userId)) {
      throw new BackupError("当前账户不存在，请重新登录", 401);
    }
    const ids = new Map(backup.resumes.map((r) => [r.id, crypto.randomUUID()]));
    const referencedPhotos = new Set([...backup.resumes, ...backup.versions].map((r) => r.photo));
    for (const photo of backup.photos) {
      if (referencedPhotos.has(photo.ref)) photoRef(db, photo.data);
    }
    const insertResume = db.prepare(`INSERT INTO resumes
      (id, user_id, title, content, template_id, theme_variables, photo, created_at, parent_id, origin_note, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const r of backup.resumes) {
      // 保留已删除母本的共同来源，但绝不链接到当前数据库内碰巧同 ID 的简历。
      if (r.parent_id && !ids.has(r.parent_id)) ids.set(r.parent_id, crypto.randomUUID());
      insertResume.run(ids.get(r.id), userId, r.title, r.content, r.template_id,
        r.theme_variables, r.photo, r.created_at, r.parent_id ? ids.get(r.parent_id) : null,
        r.origin_note, r.updated_at);
    }
    const insertVersion = db.prepare(`INSERT INTO resume_versions
      (id, resume_id, user_id, title, content, template_id, theme_variables, photo, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const v of backup.versions) {
      insertVersion.run(crypto.randomUUID(), ids.get(v.resume_id), userId, v.title, v.content,
        v.template_id, v.theme_variables, v.photo, v.created_at);
    }
    return { resumes: backup.resumes.length, versions: backup.versions.length };
  })();
}
