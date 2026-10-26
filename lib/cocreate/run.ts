import type Database from "better-sqlite3";
import crypto from "crypto";
import { Agent } from "@earendil-works/pi-agent-core";
import { AiConfig, AiConfigError, createAgentRuntime, resolveAiConfig, summarizeAiConfig } from "../ai/provider";
import { snapshotIfDue } from "../resume-versions";
import { readMarkdownRules } from "../rewrite/run-agent";
import { abortChannel, closeChannel, isChannelLive, openChannel, publish, setAbort } from "./channel";
import { applyEdit, diffHumanChanges, hasHumanChanges, HumanChanges, invertEdit, ResumeEdit } from "./edits";
import { createEventMapper } from "./events";
import { buildTurnPrompt, SCRATCH_OPENER, summarizeUserTurn } from "./prompt";
import {
  COCREATE_MAX_TURNS,
  COCREATE_SKILL,
  COCREATE_STALE_MS,
  COCREATE_TIMEOUT_MS,
  MAX_CHAT_CHARS,
  MAX_IMPORT_CHARS,
} from "./skill";
import {
  finishRun,
  getActiveRun,
  getEditForUser,
  getLastSeenContent,
  getMessage,
  getMessageForUser,
  getRun,
  insertEdit,
  insertMessage,
  insertRun,
  lastEditSeq,
  listEdits,
  listMessages,
  markEditStatus,
  updateMessage,
} from "./store";
import { createCocreateTools, CocreateToolContext } from "./tools";
import type { ChatMessage, EditRecord, RunInfo, TurnInput } from "./types";

export class CocreateError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "CocreateError";
  }
}

interface ResumeRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  template_id: string;
  theme_variables: string;
  photo: string | null;
}

function loadResume(db: Database.Database, resumeId: string, userId: string): ResumeRow {
  const row = db.prepare(`SELECT * FROM resumes WHERE id = ? AND user_id = ?`).get(resumeId, userId) as ResumeRow | undefined;
  if (!row) throw new CocreateError("简历不存在", 404);
  return row;
}

function readContent(db: Database.Database, resumeId: string): string {
  const row = db.prepare(`SELECT content FROM resumes WHERE id = ?`).get(resumeId) as { content: string } | undefined;
  return row?.content ?? "";
}

function ageMs(iso: string): number {
  const time = Date.parse(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso.replace(" ", "T")}Z`);
  return Number.isFinite(time) ? Date.now() - time : 0;
}

const INTERRUPTED = "上一轮回复中断了（服务重启或超时），可以重试。";

/** 进程里已经没有这轮运行（重启）或运行太久：标记为出错，避免永远“思考中” */
export function expireStaleRun(db: Database.Database, run: RunInfo | null): RunInfo | null {
  if (!run || run.status !== "running") return run;
  if (isChannelLive(run.id) && ageMs(run.createdAt) < COCREATE_STALE_MS) return run;
  finishRun(db, run.id, { status: "error", error: INTERRUPTED });
  if (run.assistantMessageId) {
    const message = getMessage(db, run.assistantMessageId);
    if (message?.status === "streaming") {
      updateMessage(db, run.assistantMessageId, { status: "error", meta: { ...message.meta, error: INTERRUPTED } });
    }
  }
  abortChannel(run.id);
  return getRun(db, run.id);
}

export function getCocreateState(db: Database.Database, userId: string, resumeId: string) {
  const resume = loadResume(db, resumeId, userId);
  const active = expireStaleRun(db, getActiveRun(db, resumeId));
  return {
    messages: listMessages(db, resumeId),
    edits: listEdits(db, resumeId),
    activeRun: active && active.status === "running" ? active : null,
    ai: summarizeAiConfig(),
    lastEditSeq: lastEditSeq(db),
    content: resume.content,
  };
}

export function addScratchOpener(db: Database.Database, userId: string, resumeId: string): ChatMessage {
  loadResume(db, resumeId, userId);
  const existing = listMessages(db, resumeId, 1);
  if (existing.length) throw new CocreateError("这份简历已经有对话了", 409);
  return insertMessage(db, { resumeId, userId, role: "assistant", kind: "opener", content: SCRATCH_OPENER });
}

function validateInput(input: TurnInput): void {
  if (input.kind === "chat" && !input.text.trim()) throw new CocreateError("请输入内容", 400);
  if (input.kind === "chat" && input.text.length > MAX_CHAT_CHARS) {
    throw new CocreateError(`一次最多 ${MAX_CHAT_CHARS} 字，可以分几次说`, 400);
  }
  if (input.kind === "import" && !input.text.trim()) throw new CocreateError("没有可导入的文字", 400);
  if (input.kind === "import" && input.text.length > MAX_IMPORT_CHARS) {
    throw new CocreateError(`旧简历文字超过 ${MAX_IMPORT_CHARS} 字，请删掉无关内容后再导入`, 400);
  }
}

function userFacts(messages: ChatMessage[], input: TurnInput): string[] {
  const facts = messages
    .filter((message) => message.role === "user")
    .map((message) => [message.content, typeof message.meta.importText === "string" ? message.meta.importText : ""].join("\n"));
  if (input.kind === "chat" || input.kind === "import") facts.push(input.text);
  return facts;
}

export interface StartedTurn {
  runId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export function startTurn(db: Database.Database, userId: string, resumeId: string, input: TurnInput): StartedTurn {
  const resume = loadResume(db, resumeId, userId);
  validateInput(input);
  const active = expireStaleRun(db, getActiveRun(db, resumeId));
  if (active && active.status === "running") throw new CocreateError("AI 还在回复上一条，请稍候或先停止", 409, "busy");

  let config: AiConfig;
  try {
    config = resolveAiConfig();
  } catch (error) {
    if (error instanceof AiConfigError) throw new CocreateError(error.message, 503, "ai_not_configured");
    throw error;
  }

  const history = listMessages(db, resumeId);
  const runId = crypto.randomUUID();
  const created = db.transaction(() => {
    const userMessage = insertMessage(db, {
      resumeId,
      userId,
      role: "user",
      kind: input.kind,
      content: summarizeUserTurn(input),
      meta: {
        ...(input.kind === "action" ? { action: input.action, target: input.target } : {}),
        ...(input.kind === "import" ? { importText: input.text, source: input.source || "paste" } : {}),
      },
      runId,
    });
    const assistantMessage = insertMessage(db, {
      resumeId,
      userId,
      role: "assistant",
      kind: "chat",
      content: "",
      runId,
      status: "streaming",
    });
    insertRun(db, { id: runId, resumeId, userId, assistantMessageId: assistantMessage.id });
    // AI 动手前留一份快照（遵循 5 分钟间隔），配合逐条撤销兜底
    snapshotIfDue(db, {
      resumeId,
      userId,
      manual: false,
      title: resume.title,
      content: resume.content,
      templateId: resume.template_id,
      themeVariables: resume.theme_variables,
      photo: resume.photo,
    });
    return { userMessage, assistantMessage };
  })();

  openChannel(runId);
  void executeRun(db, {
    runId,
    userId,
    resumeId,
    input,
    config,
    history,
    assistantMessageId: created.assistantMessage.id,
  }).catch((error) => {
    console.error("[cocreate] run crashed", error);
  });

  return { runId, ...created };
}

function humanChangesSinceLastRun(db: Database.Database, resumeId: string, content: string): HumanChanges | null {
  const seen = getLastSeenContent(db, resumeId);
  if (seen === null) return null;
  const changes = diffHumanChanges(seen, content);
  return hasHumanChanges(changes) ? changes : null;
}

function friendlyModelError(message: string): string {
  const text = message.replace(/\s+/g, " ").trim();
  if (/401|403|unauthori[sz]ed|invalid api key|authentication/i.test(text)) return "模型拒绝了请求：API Key 无效或没有权限。";
  if (/429|rate limit|quota|insufficient/i.test(text)) return "模型额度不足或请求过于频繁，请稍后再试。";
  if (/timeout|timed out|ETIMEDOUT|aborted/i.test(text)) return "模型响应超时，请重试。";
  return `模型请求失败：${text.length > 160 ? `${text.slice(0, 158)}…` : text}`;
}

async function executeRun(
  db: Database.Database,
  run: {
    runId: string;
    userId: string;
    resumeId: string;
    input: TurnInput;
    config: AiConfig;
    history: ChatMessage[];
    assistantMessageId: string;
  }
): Promise<void> {
  const { runId, resumeId, userId, assistantMessageId } = run;
  let text = "";
  let lastPersist = 0;
  let cancelled = false;
  let timedOut = false;
  const steps: Array<{ label: string; ok: boolean; note?: string }> = [];
  const editIds: string[] = [];

  const persistText = (force = false) => {
    const now = Date.now();
    if (!force && now - lastPersist < 1000) return;
    lastPersist = now;
    updateMessage(db, assistantMessageId, { content: text });
  };

  const finalize = (status: "done" | "error" | "cancelled", error?: string) => {
    const content = readContent(db, resumeId);
    let body = text.trim();
    if (!body && status === "done") body = editIds.length ? "已更新简历。" : "";
    const finalStatus = status === "done" && !body ? "error" : status;
    const errorText = finalStatus === "error" ? error || "AI 没有回复，请重试。" : undefined;
    updateMessage(db, assistantMessageId, {
      content: body,
      status: finalStatus,
      meta: { steps, editIds, ...(errorText ? { error: errorText } : {}) },
    });
    finishRun(db, runId, { status: finalStatus, error: errorText ?? null, seenContent: content });
    const message = getMessage(db, assistantMessageId)!;
    publish(runId, finalStatus === "error" ? { type: "error", message: errorText!, chat: message } : { type: "done", message });
    closeChannel(runId);
  };

  try {
    const runtime = await createAgentRuntime(run.config);
    const content = readContent(db, resumeId);
    const changes = humanChangesSinceLastRun(db, resumeId, content);
    const ctx: CocreateToolContext = {
      readContent: () => readContent(db, resumeId),
      commit: (edit: ResumeEdit, label: string) => {
        const { record, next } = db.transaction(() => {
          const current = readContent(db, resumeId);
          const result = applyEdit(current, edit);
          if (!result.ok) throw new Error(`没有写入：${result.reason}。请用 read_resume 读取最新内容后再试。`);
          db.prepare(`UPDATE resumes SET content = ?, updated_at = datetime('now') WHERE id = ?`).run(result.content, resumeId);
          const record = insertEdit(db, { resumeId, userId, runId, messageId: assistantMessageId, edit, label });
          return { record, next: result.content };
        })();
        editIds.push(record.id);
        publish(runId, { type: "edit", edit: record, content: next });
        return next;
      },
      view: content,
      facts: userFacts(run.history, run.input),
      protectedLines: new Set(changes?.addedLines ?? []),
      removedLines: new Set(changes?.removedLines ?? []),
      protectedFields: new Set(changes?.fields ?? []),
      action: run.input.kind === "action" ? { action: run.input.action, target: run.input.target } : null,
      markdownRules: readMarkdownRules(),
      editCount: 0,
    };

    let turns = 0;
    const agent = new Agent({
      initialState: {
        systemPrompt: COCREATE_SKILL,
        model: runtime.model,
        thinkingLevel: "off",
        tools: createCocreateTools(ctx),
      },
      streamFn: runtime.streamFn,
      getApiKey: runtime.getApiKey,
      toolExecution: "sequential",
      shouldStopAfterTurn: () => {
        turns += 1;
        return turns >= COCREATE_MAX_TURNS;
      },
    });

    const map = createEventMapper();
    agent.subscribe((event) => {
      for (const mapped of map(event as Parameters<typeof map>[0])) {
        if (mapped.type === "text") {
          text += mapped.delta;
          persistText();
        }
        if (mapped.type === "step" && mapped.phase === "end") {
          steps.push({ label: mapped.label, ok: Boolean(mapped.ok), ...(mapped.note ? { note: mapped.note } : {}) });
        }
        publish(runId, mapped);
      }
    });
    setAbort(runId, () => {
      cancelled = true;
      agent.abort();
    });
    const timer = setTimeout(() => {
      timedOut = true;
      agent.abort();
    }, COCREATE_TIMEOUT_MS);

    const prompt = buildTurnPrompt({ content, history: run.history, changes, task: run.input });
    try {
      await agent.prompt(prompt);
    } finally {
      clearTimeout(timer);
    }

    if (cancelled) return finalize("cancelled");
    if (timedOut) return finalize("error", "AI 响应超时（超过 2 分钟），已停止。已写入的修改会保留。");
    const errorMessage = agent.state.errorMessage;
    if (errorMessage && !text.trim()) return finalize("error", friendlyModelError(errorMessage));
    persistText(true);
    return finalize("done");
  } catch (error) {
    if (cancelled) return finalize("cancelled");
    if (error instanceof AiConfigError) return finalize("error", error.message);
    return finalize("error", friendlyModelError(error instanceof Error ? error.message : String(error)));
  }
}

export function cancelRun(db: Database.Database, userId: string, runId: string): boolean {
  const run = getRun(db, runId);
  if (!run) throw new CocreateError("找不到这轮对话", 404);
  loadResume(db, run.resumeId, userId);
  if (run.status !== "running") return false;
  if (abortChannel(runId)) return true;
  expireStaleRun(db, run);
  return true;
}

export function retryRun(db: Database.Database, userId: string, messageId: string): StartedTurn {
  const message = getMessageForUser(db, messageId, userId);
  if (!message || message.role !== "assistant" || !message.runId) throw new CocreateError("找不到这条回复", 404);
  const messages = listMessages(db, message.resumeId);
  const user = messages.find((item) => item.role === "user" && item.runId === message.runId);
  if (!user) throw new CocreateError("找不到对应的提问", 404);
  const input: TurnInput | null =
    user.kind === "chat"
      ? { kind: "chat", text: user.content }
      : user.kind === "review"
        ? { kind: "review" }
        : user.kind === "import"
          ? { kind: "import", text: String(user.meta.importText || ""), source: user.meta.source === "pdf" ? "pdf" : "paste" }
          : user.kind === "action"
            ? { kind: "action", action: user.meta.action as "tighten", target: user.meta.target as { section: string } }
            : null;
  if (!input) throw new CocreateError("这条消息不能重试", 400);
  // 失败的这一轮从对话里移除，重新发起
  db.prepare(`DELETE FROM cocreate_messages WHERE id IN (?, ?)`).run(user.id, message.id);
  const started = startTurn(db, userId, message.resumeId, input);
  // 失败那一轮已经写入的修改挂到新回复下，仍可整轮撤销
  db.prepare(`UPDATE cocreate_edits SET message_id = ? WHERE message_id = ?`).run(started.assistantMessage.id, message.id);
  return started;
}

export interface RevertResult {
  content: string;
  edits: EditRecord[];
  reverted: ResumeEdit[];
}

function revertMany(db: Database.Database, resumeId: string, records: EditRecord[]): RevertResult {
  return db.transaction(() => {
    let content = readContent(db, resumeId);
    const reverted: ResumeEdit[] = [];
    for (const record of [...records].sort((a, b) => b.seq - a.seq)) {
      const inverse = invertEdit(record.edit);
      const result = applyEdit(content, inverse);
      if (!result.ok) {
        throw new CocreateError(`无法撤销「${record.label}」：${result.reason}。可以手动修改，或到历史版本里恢复。`, 409, "conflict");
      }
      content = result.content;
      reverted.push(inverse);
      markEditStatus(db, record.id, "reverted");
    }
    db.prepare(`UPDATE resumes SET content = ?, updated_at = datetime('now') WHERE id = ?`).run(content, resumeId);
    return { content, edits: listEdits(db, resumeId), reverted };
  })();
}

export function revertEdit(db: Database.Database, userId: string, editId: string): RevertResult {
  const record = getEditForUser(db, editId, userId);
  if (!record) throw new CocreateError("找不到这处修改", 404);
  if (record.status === "reverted") throw new CocreateError("这处修改已经撤销过了", 409);
  assertIdle(db, record.resumeId);
  return revertMany(db, record.resumeId, [record]);
}

export function revertMessage(db: Database.Database, userId: string, messageId: string): RevertResult {
  const message = getMessageForUser(db, messageId, userId);
  if (!message) throw new CocreateError("找不到这条回复", 404);
  assertIdle(db, message.resumeId);
  const records = listEdits(db, message.resumeId).filter((edit) => edit.messageId === messageId && edit.status === "applied");
  if (!records.length) throw new CocreateError("这一轮没有可撤销的修改", 409);
  return revertMany(db, message.resumeId, records);
}

function assertIdle(db: Database.Database, resumeId: string): void {
  const active = expireStaleRun(db, getActiveRun(db, resumeId));
  if (active?.status === "running") throw new CocreateError("AI 正在修改简历，等它写完再撤销", 409, "busy");
}
