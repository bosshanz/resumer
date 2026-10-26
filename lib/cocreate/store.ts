import type Database from "better-sqlite3";
import crypto from "crypto";
import type { ResumeEdit } from "./edits";
import type { ChatMessage, ChatMessageKind, ChatRole, ChatStatus, EditRecord, RunInfo, RunStatus } from "./types";

// 共创数据：每份简历一条对话；每轮 AI 运行一条 run；每次 AI 修改一条 edit（seq 单调递增，用于断线重放与保存重放）

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS cocreate_messages (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'chat',
  content TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT '{}',
  run_id TEXT,
  status TEXT NOT NULL DEFAULT 'done',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_cocreate_messages_resume ON cocreate_messages(resume_id, created_at);

CREATE TABLE IF NOT EXISTS cocreate_runs (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  error TEXT,
  assistant_message_id TEXT,
  seen_content TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_cocreate_runs_resume ON cocreate_runs(resume_id, created_at);

CREATE TABLE IF NOT EXISTS cocreate_edits (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  resume_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  run_id TEXT,
  message_id TEXT,
  edit TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'applied',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_cocreate_edits_resume ON cocreate_edits(resume_id, seq);
`;

export function ensureCocreateTables(db: Database.Database): void {
  db.exec(TABLE_SQL);
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    role: String(row.role) as ChatRole,
    kind: String(row.kind) as ChatMessageKind,
    content: String(row.content ?? ""),
    meta: parseJson<Record<string, unknown>>(row.meta, {}),
    runId: row.run_id ? String(row.run_id) : null,
    status: String(row.status) as ChatStatus,
    createdAt: String(row.created_at),
  };
}

function toEdit(row: Record<string, unknown>): EditRecord {
  return {
    id: String(row.id),
    seq: Number(row.seq),
    runId: row.run_id ? String(row.run_id) : null,
    messageId: row.message_id ? String(row.message_id) : null,
    edit: parseJson<ResumeEdit>(row.edit, { kind: "lines", scope: {}, before: [], after: [] }),
    label: String(row.label ?? ""),
    status: row.status === "reverted" ? "reverted" : "applied",
    createdAt: String(row.created_at),
  };
}

function toRun(row: Record<string, unknown>): RunInfo {
  return {
    id: String(row.id),
    resumeId: String(row.resume_id),
    status: String(row.status) as RunStatus,
    error: row.error ? String(row.error) : null,
    assistantMessageId: row.assistant_message_id ? String(row.assistant_message_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function insertMessage(
  db: Database.Database,
  input: {
    resumeId: string;
    userId: string;
    role: ChatRole;
    kind: ChatMessageKind;
    content: string;
    meta?: Record<string, unknown>;
    runId?: string | null;
    status?: ChatStatus;
  }
): ChatMessage {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO cocreate_messages (id, resume_id, user_id, role, kind, content, meta, run_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.resumeId,
    input.userId,
    input.role,
    input.kind,
    input.content,
    JSON.stringify(input.meta ?? {}),
    input.runId ?? null,
    input.status ?? "done"
  );
  return getMessage(db, id)!;
}

export function getMessage(db: Database.Database, id: string): ChatMessage | null {
  const row = db.prepare(`SELECT * FROM cocreate_messages WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? toMessage(row) : null;
}

export function getMessageForUser(db: Database.Database, id: string, userId: string): (ChatMessage & { resumeId: string }) | null {
  const row = db
    .prepare(`SELECT * FROM cocreate_messages WHERE id = ? AND user_id = ?`)
    .get(id, userId) as Record<string, unknown> | undefined;
  return row ? { ...toMessage(row), resumeId: String(row.resume_id) } : null;
}

export function updateMessage(
  db: Database.Database,
  id: string,
  patch: { content?: string; status?: ChatStatus; meta?: Record<string, unknown> }
): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.content !== undefined) {
    sets.push("content = ?");
    values.push(patch.content);
  }
  if (patch.status !== undefined) {
    sets.push("status = ?");
    values.push(patch.status);
  }
  if (patch.meta !== undefined) {
    sets.push("meta = ?");
    values.push(JSON.stringify(patch.meta));
  }
  if (!sets.length) return;
  db.prepare(`UPDATE cocreate_messages SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
}

export function listMessages(db: Database.Database, resumeId: string, limit = 200): ChatMessage[] {
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT *, rowid AS r FROM cocreate_messages WHERE resume_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?
       ) ORDER BY created_at ASC, r ASC`
    )
    .all(resumeId, limit) as Record<string, unknown>[];
  return rows.map(toMessage);
}

export function insertRun(
  db: Database.Database,
  input: { id: string; resumeId: string; userId: string; assistantMessageId: string }
): RunInfo {
  db.prepare(
    `INSERT INTO cocreate_runs (id, resume_id, user_id, assistant_message_id) VALUES (?, ?, ?, ?)`
  ).run(input.id, input.resumeId, input.userId, input.assistantMessageId);
  return getRun(db, input.id)!;
}

export function getRun(db: Database.Database, id: string): RunInfo | null {
  const row = db.prepare(`SELECT * FROM cocreate_runs WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? toRun(row) : null;
}

export function getRunForUser(db: Database.Database, id: string, userId: string): RunInfo | null {
  const row = db
    .prepare(`SELECT * FROM cocreate_runs WHERE id = ? AND user_id = ?`)
    .get(id, userId) as Record<string, unknown> | undefined;
  return row ? toRun(row) : null;
}

export function getActiveRun(db: Database.Database, resumeId: string): RunInfo | null {
  const row = db
    .prepare(`SELECT * FROM cocreate_runs WHERE resume_id = ? AND status = 'running' ORDER BY created_at DESC LIMIT 1`)
    .get(resumeId) as Record<string, unknown> | undefined;
  return row ? toRun(row) : null;
}

export function finishRun(
  db: Database.Database,
  id: string,
  input: { status: Exclude<RunStatus, "running">; error?: string | null; seenContent?: string | null }
): void {
  db.prepare(
    `UPDATE cocreate_runs
       SET status = ?, error = ?, seen_content = COALESCE(?, seen_content),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND status = 'running'`
  ).run(input.status, input.error ?? null, input.seenContent ?? null, id);
}

/** AI 上一次“看过”的简历内容：用来识别这之后的人工改动 */
export function getLastSeenContent(db: Database.Database, resumeId: string): string | null {
  const row = db
    .prepare(
      `SELECT seen_content FROM cocreate_runs
        WHERE resume_id = ? AND seen_content IS NOT NULL
        ORDER BY created_at DESC, rowid DESC LIMIT 1`
    )
    .get(resumeId) as { seen_content: string } | undefined;
  return row ? row.seen_content : null;
}

export function insertEdit(
  db: Database.Database,
  input: { resumeId: string; userId: string; runId: string | null; messageId: string | null; edit: ResumeEdit; label: string }
): EditRecord {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO cocreate_edits (id, resume_id, user_id, run_id, message_id, edit, label)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.resumeId, input.userId, input.runId, input.messageId, JSON.stringify(input.edit), input.label);
  return getEdit(db, id)!;
}

export function getEdit(db: Database.Database, id: string): EditRecord | null {
  const row = db.prepare(`SELECT * FROM cocreate_edits WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? toEdit(row) : null;
}

export function getEditForUser(db: Database.Database, id: string, userId: string): (EditRecord & { resumeId: string }) | null {
  const row = db
    .prepare(`SELECT * FROM cocreate_edits WHERE id = ? AND user_id = ?`)
    .get(id, userId) as Record<string, unknown> | undefined;
  return row ? { ...toEdit(row), resumeId: String(row.resume_id) } : null;
}

export function listEdits(db: Database.Database, resumeId: string): EditRecord[] {
  const rows = db
    .prepare(`SELECT * FROM cocreate_edits WHERE resume_id = ? ORDER BY seq ASC`)
    .all(resumeId) as Record<string, unknown>[];
  return rows.map(toEdit);
}

export function listEditsAfter(db: Database.Database, resumeId: string, seq: number): EditRecord[] {
  const rows = db
    .prepare(`SELECT * FROM cocreate_edits WHERE resume_id = ? AND seq > ? AND status = 'applied' ORDER BY seq ASC`)
    .all(resumeId, seq) as Record<string, unknown>[];
  return rows.map(toEdit);
}

/** 全局编辑水位：seq 跨简历单调递增（AUTOINCREMENT），清空对话后也不会回退 */
export function lastEditSeq(db: Database.Database): number {
  // 还没建过共创表（或从未写过编辑）时 sqlite_sequence 可能不存在
  const ready = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'`).get();
  if (!ready) return 0;
  const row = db
    .prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'cocreate_edits'`)
    .get() as { seq: number } | undefined;
  return Number(row?.seq) || 0;
}

export function markEditStatus(db: Database.Database, id: string, status: "applied" | "reverted"): void {
  db.prepare(`UPDATE cocreate_edits SET status = ? WHERE id = ?`).run(status, id);
}

export function clearConversation(db: Database.Database, resumeId: string): void {
  db.prepare(`DELETE FROM cocreate_messages WHERE resume_id = ?`).run(resumeId);
  db.prepare(`DELETE FROM cocreate_runs WHERE resume_id = ? AND status != 'running'`).run(resumeId);
  db.prepare(`DELETE FROM cocreate_edits WHERE resume_id = ?`).run(resumeId);
}

export function deleteCocreateForResume(db: Database.Database, resumeId: string): void {
  db.prepare(`DELETE FROM cocreate_messages WHERE resume_id = ?`).run(resumeId);
  db.prepare(`DELETE FROM cocreate_runs WHERE resume_id = ?`).run(resumeId);
  db.prepare(`DELETE FROM cocreate_edits WHERE resume_id = ?`).run(resumeId);
}
