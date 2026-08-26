import type Database from "better-sqlite3";
import crypto from "crypto";
import { normalizeResume, briefVariantLabel } from "../resumes";
import { Resume } from "../types";
import { briefError } from "./brief";
import {
  MAX_FOLLOW_UP_CHARS,
  MAX_RESUME_CONTENT_CHARS,
} from "./limits";
import { RewriteConfigError, RewriteAgentError, runRewriteAgent } from "./run-agent";
import {
  beginContinueGeneration,
  beginRewriteGeneration,
  getActiveRewriteSession,
  getRewriteSession,
  markStaleGeneratingSessions,
  updateRewriteSession,
} from "./sessions";
import { RewriteSession } from "./types";

export class RewriteRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RewriteRequestError";
    this.status = status;
  }
}

function requireOwnedResume(db: Database.Database, resumeId: string, userId: string): Record<string, unknown> {
  const row = db
    .prepare(`SELECT * FROM resumes WHERE id = ? AND user_id = ?`)
    .get(resumeId, userId) as Record<string, unknown> | undefined;
  if (!row) {
    throw new RewriteRequestError(404, "简历不存在");
  }
  return row;
}

function assertBounds(brief: string, content: string, followUp?: string): void {
  const briefProblem = briefError(brief);
  if (briefProblem) {
    throw new RewriteRequestError(400, briefProblem);
  }
  if (content.length > MAX_RESUME_CONTENT_CHARS) {
    throw new RewriteRequestError(400, "简历内容过长，无法改写");
  }
  if (followUp !== undefined && followUp.trim().length === 0) {
    throw new RewriteRequestError(400, "请填写再改一版的要求");
  }
  if (followUp !== undefined && followUp.length > MAX_FOLLOW_UP_CHARS) {
    throw new RewriteRequestError(400, "再改一版的要求过长");
  }
}

export function loadActiveRewrite(
  db: Database.Database,
  sourceResumeId: string,
  userId: string
): RewriteSession | null {
  markStaleGeneratingSessions(db);
  requireOwnedResume(db, sourceResumeId, userId);
  return getActiveRewriteSession(db, sourceResumeId, userId);
}

async function generateIntoSession(
  db: Database.Database,
  session: RewriteSession,
  input: { sourceContent: string; brief: string; currentDraft?: string; followUp?: string }
): Promise<RewriteSession> {
  try {
    const result = await runRewriteAgent({
      sourceContent: input.sourceContent,
      brief: input.brief,
      currentDraft: input.currentDraft,
      followUp: input.followUp,
    });
    return updateRewriteSession(db, session.id, session.userId, {
      status: "ready",
      draftContent: result.draft.content,
      changeNotes: result.draft.changeNotes,
      pendingItems: result.draft.pendingItems,
      errorMessage: "",
    })!;
  } catch (error) {
    const message =
      error instanceof RewriteConfigError || error instanceof RewriteAgentError
        ? error.message
        : "生成建议稿失败，请重试";
    updateRewriteSession(db, session.id, session.userId, {
      status: "error",
      errorMessage: message,
    });
    if (error instanceof RewriteConfigError) {
      throw new RewriteRequestError(503, message);
    }
    throw new RewriteRequestError(502, message);
  }
}

export async function startRewrite(
  db: Database.Database,
  input: { userId: string; resumeId: string; brief: string }
): Promise<RewriteSession> {
  const resume = requireOwnedResume(db, input.resumeId, input.userId);
  const content = String(resume.content || "");
  assertBounds(input.brief, content);

  let session: RewriteSession;
  try {
    session = db.transaction(() =>
      beginRewriteGeneration(db, {
        userId: input.userId,
        sourceResumeId: input.resumeId,
        brief: input.brief,
      })
    )();
  } catch (error) {
    if (error instanceof Error && error.message === "GENERATING") {
      throw new RewriteRequestError(409, "正在生成建议稿，请稍候");
    }
    throw error;
  }

  return generateIntoSession(db, session, {
    sourceContent: content,
    brief: input.brief,
  });
}

export async function continueRewrite(
  db: Database.Database,
  input: { userId: string; sessionId: string; instruction: string }
): Promise<RewriteSession> {
  const existing = getRewriteSession(db, input.sessionId, input.userId);
  if (!existing) throw new RewriteRequestError(404, "改写会话不存在");
  const resume = requireOwnedResume(db, existing.sourceResumeId, input.userId);
  assertBounds(existing.brief, String(resume.content || ""), input.instruction);

  let session: RewriteSession;
  try {
    session = db.transaction(() =>
      beginContinueGeneration(db, { userId: input.userId, sessionId: input.sessionId })
    )();
  } catch (error) {
    if (error instanceof Error && error.message === "GENERATING") {
      throw new RewriteRequestError(409, "正在生成建议稿，请稍候");
    }
    if (error instanceof Error && error.message === "NOT_FOUND") {
      throw new RewriteRequestError(404, "改写会话不存在");
    }
    if (error instanceof Error && error.message === "NOT_READY") {
      throw new RewriteRequestError(409, "请先生成建议稿");
    }
    throw error;
  }

  return generateIntoSession(db, session, {
    sourceContent: String(resume.content || ""),
    brief: session.brief,
    currentDraft: session.draftContent,
    followUp: input.instruction,
  });
}

export function applyRewrite(
  db: Database.Database,
  input: { userId: string; sessionId: string }
): { session: RewriteSession; resume: Resume } {
  const session = getRewriteSession(db, input.sessionId, input.userId);
  if (!session) throw new RewriteRequestError(404, "改写会话不存在");
  if (session.status === "applied" && session.resultResumeId) {
    const existing = requireOwnedResume(db, session.resultResumeId, input.userId);
    return { session, resume: normalizeResume(existing)! };
  }
  if (session.status !== "ready" || !session.draftContent.trim()) {
    throw new RewriteRequestError(409, "没有可另存的建议稿");
  }

  const source = requireOwnedResume(db, session.sourceResumeId, input.userId);
  const sourceTitle = String(source.title || "未命名简历");
  // 变体统一锚到最初的母本而不是直接底稿，保证多次改写/复制都归在同一组
  const parentId = source.parent_id ? String(source.parent_id) : String(source.id);
  const label = briefVariantLabel(session.brief);
  const title = label
    ? `${sourceTitle} · 改写 · ${label}`.slice(0, 200)
    : `${sourceTitle} · 改写`.slice(0, 200);
  const originNote = briefVariantLabel(session.brief, 40) || session.brief.slice(0, 40).trim();
  const id = crypto.randomUUID();

  const apply = db.transaction(() => {
    db.prepare(
      `INSERT INTO resumes (id, user_id, title, content, template_id, theme_variables, photo, parent_id, origin_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.userId,
      title,
      session.draftContent,
      String(source.template_id),
      String(source.theme_variables),
      source.photo ? String(source.photo) : null,
      parentId,
      originNote || null
    );
    updateRewriteSession(db, session.id, input.userId, {
      status: "applied",
      resultResumeId: id,
    });
  });
  apply();

  const resume = normalizeResume(
    db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(id) as Record<string, unknown>
  )!;
  return { session: getRewriteSession(db, session.id, input.userId)!, resume };
}

export function discardRewrite(
  db: Database.Database,
  input: { userId: string; sessionId: string }
): RewriteSession {
  const session = getRewriteSession(db, input.sessionId, input.userId);
  if (!session) throw new RewriteRequestError(404, "改写会话不存在");
  if (session.status === "generating") {
    throw new RewriteRequestError(409, "正在生成建议稿，请稍候");
  }
  if (session.status === "discarded") return session;
  if (session.status === "applied") {
    throw new RewriteRequestError(409, "已经另存为新简历");
  }
  return updateRewriteSession(db, session.id, input.userId, { status: "discarded" })!;
}
