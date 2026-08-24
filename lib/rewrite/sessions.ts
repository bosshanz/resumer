import type Database from "better-sqlite3";
import crypto from "crypto";
import { STALE_GENERATING_MS } from "./limits";
import { isRewriteStatus, RewriteSession, RewriteStatus } from "./types";

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS rewrite_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_resume_id TEXT NOT NULL,
  result_resume_id TEXT,
  job_description TEXT NOT NULL DEFAULT '',
  draft_content TEXT NOT NULL DEFAULT '',
  change_notes TEXT NOT NULL DEFAULT '[]',
  pending_items TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'generating',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rewrite_sessions_user_id ON rewrite_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_rewrite_sessions_source ON rewrite_sessions(source_resume_id);
`;

export function ensureRewriteSessionsTable(db: Database.Database): void {
  db.exec(TABLE_SQL);
}

function parseStringList(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function parseSqliteTime(value: string): number {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const timestamp = Date.parse(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  return Number.isFinite(timestamp) ? timestamp : Date.parse(value);
}

export function normalizeRewriteSession(row: Record<string, unknown> | undefined): RewriteSession | null {
  if (!row) return null;
  const statusRaw = String(row.status || "error");
  const status: RewriteStatus = isRewriteStatus(statusRaw) ? statusRaw : "error";
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sourceResumeId: String(row.source_resume_id),
    resultResumeId: row.result_resume_id ? String(row.result_resume_id) : undefined,
    brief: String(row.job_description ?? ""),
    draftContent: String(row.draft_content ?? ""),
    changeNotes: parseStringList(row.change_notes),
    pendingItems: parseStringList(row.pending_items),
    status,
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function createRewriteSession(
  db: Database.Database,
  input: { userId: string; sourceResumeId: string; brief: string }
): RewriteSession {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO rewrite_sessions (id, user_id, source_resume_id, job_description, status)
     VALUES (?, ?, ?, ?, 'generating')`
  ).run(id, input.userId, input.sourceResumeId, input.brief);
  return getRewriteSession(db, id, input.userId)!;
}

export function getRewriteSession(
  db: Database.Database,
  id: string,
  userId: string
): RewriteSession | null {
  const row = db
    .prepare(`SELECT * FROM rewrite_sessions WHERE id = ? AND user_id = ?`)
    .get(id, userId) as Record<string, unknown> | undefined;
  return normalizeRewriteSession(row);
}

export function getActiveRewriteSession(
  db: Database.Database,
  sourceResumeId: string,
  userId: string
): RewriteSession | null {
  const row = db
    .prepare(
      `SELECT * FROM rewrite_sessions
       WHERE source_resume_id = ? AND user_id = ? AND status IN ('generating', 'ready', 'error')
       ORDER BY updated_at DESC
       LIMIT 1`
    )
    .get(sourceResumeId, userId) as Record<string, unknown> | undefined;
  return normalizeRewriteSession(row);
}

export function markStaleGeneratingSessions(
  db: Database.Database,
  now = Date.now(),
  staleMs = STALE_GENERATING_MS
): void {
  const rows = db
    .prepare(`SELECT id, updated_at FROM rewrite_sessions WHERE status = 'generating'`)
    .all() as { id: string; updated_at: string }[];

  const staleIds = rows
    .filter((row) => now - parseSqliteTime(row.updated_at) > staleMs)
    .map((row) => row.id);
  if (staleIds.length === 0) return;

  const placeholders = staleIds.map(() => "?").join(", ");
  db.prepare(
    `UPDATE rewrite_sessions
     SET status = 'error', error_message = ?, updated_at = datetime('now')
     WHERE id IN (${placeholders})`
  ).run("生成中断，请重试", ...staleIds);
}

export function beginRewriteGeneration(
  db: Database.Database,
  input: { userId: string; sourceResumeId: string; brief: string }
): RewriteSession {
  markStaleGeneratingSessions(db);
  const existing = getActiveRewriteSession(db, input.sourceResumeId, input.userId);
  if (existing?.status === "generating") {
    throw new Error("GENERATING");
  }
  if (existing) {
    return updateRewriteSession(db, existing.id, input.userId, {
      status: "generating",
      brief: input.brief,
      draftContent: "",
      changeNotes: [],
      pendingItems: [],
      errorMessage: "",
    })!;
  }
  return createRewriteSession(db, input);
}

export function beginContinueGeneration(
  db: Database.Database,
  input: { userId: string; sessionId: string }
): RewriteSession {
  markStaleGeneratingSessions(db);
  const result = db
    .prepare(
      `UPDATE rewrite_sessions
       SET status = 'generating', error_message = '', updated_at = datetime('now')
       WHERE id = ? AND user_id = ? AND status = 'ready'`
    )
    .run(input.sessionId, input.userId);
  if (result.changes === 0) {
    const session = getRewriteSession(db, input.sessionId, input.userId);
    if (!session) throw new Error("NOT_FOUND");
    if (session.status === "generating") throw new Error("GENERATING");
    throw new Error("NOT_READY");
  }
  return getRewriteSession(db, input.sessionId, input.userId)!;
}

export function updateRewriteSession(
  db: Database.Database,
  id: string,
  userId: string,
  patch: Partial<
    Pick<
      RewriteSession,
      | "brief"
      | "draftContent"
      | "changeNotes"
      | "pendingItems"
      | "status"
      | "errorMessage"
      | "resultResumeId"
    >
  >
): RewriteSession | null {
  const existing = getRewriteSession(db, id, userId);
  if (!existing) return null;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (patch.brief !== undefined) {
    updates.push("job_description = ?");
    values.push(patch.brief);
  }
  if (patch.draftContent !== undefined) {
    updates.push("draft_content = ?");
    values.push(patch.draftContent);
  }
  if (patch.changeNotes !== undefined) {
    updates.push("change_notes = ?");
    values.push(JSON.stringify(patch.changeNotes));
  }
  if (patch.pendingItems !== undefined) {
    updates.push("pending_items = ?");
    values.push(JSON.stringify(patch.pendingItems));
  }
  if (patch.status !== undefined) {
    updates.push("status = ?");
    values.push(patch.status);
  }
  if (patch.errorMessage !== undefined) {
    updates.push("error_message = ?");
    values.push(patch.errorMessage);
  }
  if (patch.resultResumeId !== undefined) {
    updates.push("result_resume_id = ?");
    values.push(patch.resultResumeId);
  }

  if (updates.length === 0) return existing;

  updates.push("updated_at = datetime('now')");
  values.push(id, userId);
  db.prepare(
    `UPDATE rewrite_sessions SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
  ).run(...values);
  return getRewriteSession(db, id, userId);
}

export function deleteRewriteSessionsForResume(db: Database.Database, resumeId: string): void {
  db.prepare(
    `DELETE FROM rewrite_sessions WHERE source_resume_id = ? OR result_resume_id = ?`
  ).run(resumeId, resumeId);
}
