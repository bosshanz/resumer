import type Database from "better-sqlite3";
import crypto from "crypto";

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS resume_versions (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  template_id TEXT NOT NULL,
  theme_variables TEXT NOT NULL,
  photo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resume_versions_resume ON resume_versions(resume_id, created_at);
`;

// 每份简历保留的快照份数；自动快照的最小间隔
export const KEEP_VERSIONS = 20;
export const SNAPSHOT_MIN_INTERVAL_MS = 5 * 60 * 1000;

export interface ResumeVersionState {
  title: string;
  content: string;
  templateId: string;
  themeVariables: string;
  photo: string | null;
}

export interface ResumeVersion extends ResumeVersionState {
  id: string;
  resumeId: string;
  userId: string;
  createdAt: string;
}

export function ensureResumeVersionsTable(db: Database.Database): void {
  db.exec(TABLE_SQL);
}

export function normalizeResumeVersion(row: Record<string, unknown> | undefined): ResumeVersion | null {
  if (!row) return null;
  return {
    id: String(row.id),
    resumeId: String(row.resume_id),
    userId: String(row.user_id),
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    templateId: String(row.template_id ?? "minimal"),
    themeVariables: String(row.theme_variables ?? "{}"),
    photo: row.photo ? String(row.photo) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

function parseDbTime(value: string): number {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const timestamp = Date.parse(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sameState(a: ResumeVersionState | null, b: ResumeVersionState): boolean {
  if (!a) return false;
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.templateId === b.templateId &&
    a.themeVariables === b.themeVariables &&
    (a.photo ?? "") === (b.photo ?? "")
  );
}

// 手动保存立即留档（仅去重相同状态）；自动保存需要距上一份快照超过间隔且有实际变化
export function shouldSnapshot(
  latest: Pick<ResumeVersion, "createdAt"> & ResumeVersionState | null,
  next: ResumeVersionState,
  options: { manual: boolean; now?: number; minIntervalMs?: number }
): boolean {
  if (!latest) return true;
  if (sameState(latest, next)) return false;
  if (options.manual) return true;
  const now = options.now ?? Date.now();
  const minInterval = options.minIntervalMs ?? SNAPSHOT_MIN_INTERVAL_MS;
  return now - parseDbTime(latest.createdAt) >= minInterval;
}

export function getLatestResumeVersion(
  db: Database.Database,
  resumeId: string
): ResumeVersion | null {
  const row = db
    .prepare(
      `SELECT * FROM resume_versions WHERE resume_id = ?
       ORDER BY created_at DESC, rowid DESC LIMIT 1`
    )
    .get(resumeId) as Record<string, unknown> | undefined;
  return normalizeResumeVersion(row);
}

export function listResumeVersions(
  db: Database.Database,
  resumeId: string
): ResumeVersion[] {
  const rows = db
    .prepare(
      `SELECT * FROM resume_versions WHERE resume_id = ?
       ORDER BY created_at DESC, rowid DESC`
    )
    .all(resumeId) as Record<string, unknown>[];
  return rows
    .map((row) => normalizeResumeVersion(row))
    .filter((version): version is ResumeVersion => version !== null);
}

export function getResumeVersion(
  db: Database.Database,
  resumeId: string,
  versionId: string
): ResumeVersion | null {
  const row = db
    .prepare(`SELECT * FROM resume_versions WHERE id = ? AND resume_id = ?`)
    .get(versionId, resumeId) as Record<string, unknown> | undefined;
  return normalizeResumeVersion(row);
}

function pruneVersions(db: Database.Database, resumeId: string): void {
  db.prepare(
    `DELETE FROM resume_versions WHERE resume_id = ? AND id NOT IN (
       SELECT id FROM resume_versions WHERE resume_id = ?
       ORDER BY created_at DESC, rowid DESC LIMIT ?
     )`
  ).run(resumeId, resumeId, KEEP_VERSIONS);
}

export function createResumeVersion(
  db: Database.Database,
  input: { resumeId: string; userId: string } & ResumeVersionState
): ResumeVersion {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO resume_versions
       (id, resume_id, user_id, title, content, template_id, theme_variables, photo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.resumeId,
    input.userId,
    input.title,
    input.content,
    input.templateId,
    input.themeVariables,
    input.photo
  );
  pruneVersions(db, input.resumeId);
  return getResumeVersion(db, input.resumeId, id)!;
}

// PATCH 保存后调用：按规则决定是否留档；返回是否实际创建了快照
export function snapshotIfDue(
  db: Database.Database,
  input: { resumeId: string; userId: string; manual: boolean } & ResumeVersionState
): boolean {
  const latest = getLatestResumeVersion(db, input.resumeId);
  if (!shouldSnapshot(latest, input, { manual: input.manual })) return false;
  createResumeVersion(db, input);
  return true;
}

export function deleteResumeVersionsForResume(db: Database.Database, resumeId: string): void {
  db.prepare(`DELETE FROM resume_versions WHERE resume_id = ?`).run(resumeId);
}

// 列表展示用：压缩正文为单行预览
export function versionContentPreview(content: string, max = 60): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (!collapsed) return "（空）";
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}
