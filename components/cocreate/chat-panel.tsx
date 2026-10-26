"use client";

import { ChangeEvent, KeyboardEvent, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUp,
  Check,
  FileText,
  FileUp,
  Loader2,
  MessageSquarePlus,
  PenLine,
  RotateCcw,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { ChatMessage, EditRecord, SelectionAction } from "@/lib/cocreate/types";
import { SELECTION_ACTION_LABELS } from "@/lib/cocreate/types";
import type { CocreateController, LiveStep } from "./use-cocreate";

interface ChatPanelProps {
  controller: CocreateController;
  resumeBlank: boolean;
  onStartScratch: () => void;
  startingScratch: boolean;
}

const IMPORT_LIMIT = 20000;

function isComposing(event: KeyboardEvent) {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

/** AI 回复里的「待补：…」用浅色标出来，其余保留换行 */
function ReplyText({ text }: { text: string }) {
  const parts = text.split(/(「待补[:：][^」]*」)/g);
  return (
    <>
      {parts.map((part, index) =>
        /^「待补[:：]/.test(part) ? (
          <span key={index} className="cc-reply-pending">{part}</span>
        ) : (
          part.split(/(\*\*[^*]+\*\*)/g).map((piece, inner) =>
            /^\*\*[^*]+\*\*$/.test(piece) ? <strong key={`${index}-${inner}`}>{piece.slice(2, -2)}</strong> : <span key={`${index}-${inner}`}>{piece}</span>
          )
        )
      )}
    </>
  );
}

function StepList({ steps }: { steps: LiveStep[] }) {
  if (!steps.length) return null;
  return (
    <ul className="cc-steps" aria-label="AI 的操作">
      {steps.map((step, index) => (
        <li key={step.callId || `step-${index}`} data-state={step.phase === "start" ? "running" : step.ok === false ? "failed" : "done"}>
          {step.phase === "start" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : step.ok === false ? (
            <X className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden />
          )}
          <span>{step.label}</span>
          {step.ok === false && step.note && <span className="cc-step-note">· {step.note}</span>}
        </li>
      ))}
    </ul>
  );
}

function readSteps(message: ChatMessage): LiveStep[] {
  const steps = message.meta.steps;
  return Array.isArray(steps) ? (steps as LiveStep[]) : [];
}

/** 行级改动给出改后的那一行，方便对照；字段改动的标签里已含新值 */
function editExcerpt(record: EditRecord): string {
  const { edit } = record;
  if (edit.kind !== "lines") return "";
  const added = edit.after.filter((line) => line.trim() && !edit.before.includes(line));
  const line = added.at(-1) ?? "";
  return line.replace(/^\s*(?:#{1,6}\s+|[-*+]\s+)/, "").replace(/\*\*/g, "").trim();
}

function EditList({
  edits,
  busy,
  onRevert,
  onRevertAll,
}: {
  edits: EditRecord[];
  busy: boolean;
  onRevert: (id: string) => void;
  onRevertAll: () => void;
}) {
  if (!edits.length) return null;
  const applied = edits.filter((edit) => edit.status === "applied");
  return (
    <div className="cc-edits">
      <div className="cc-edits-head">
        <span>
          改动 {edits.length} 处{applied.length < edits.length ? `，已撤销 ${edits.length - applied.length} 处` : ""}
        </span>
        {applied.length > 1 && (
          <button type="button" disabled={busy} onClick={onRevertAll}>
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            全部撤销
          </button>
        )}
      </div>
      <ul>
        {edits.map((edit) => (
          <li key={edit.id} data-reverted={edit.status === "reverted" || undefined}>
            <span className="cc-edit-text">
              <span className="cc-edit-label">{edit.label}</span>
              {editExcerpt(edit) && <span className="cc-edit-excerpt">{editExcerpt(edit)}</span>}
            </span>
            {edit.status === "applied" ? (
              <button type="button" disabled={busy} onClick={() => onRevert(edit.id)} aria-label={`撤销：${edit.label}`}>
                撤销
              </button>
            ) : (
              <span className="cc-edit-state">已撤销</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UserBubble({ message }: { message: ChatMessage }) {
  const action = message.meta.action as SelectionAction | undefined;
  return (
    <div className="cc-msg cc-msg-user">
      <div className="cc-bubble">
        {message.kind === "action" && action ? (
          <>
            <span className="cc-bubble-tag">{SELECTION_ACTION_LABELS[action] ?? "快捷操作"}</span>
            <span className="cc-bubble-quote">{message.content.replace(/^[^：]+：/, "")}</span>
          </>
        ) : message.kind === "import" ? (
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
            {message.content}
          </span>
        ) : (
          message.content
        )}
      </div>
    </div>
  );
}

function StartScreen({
  resumeBlank,
  aiReady,
  busy,
  startingScratch,
  onScratch,
  onReview,
  onImport,
}: {
  resumeBlank: boolean;
  aiReady: boolean;
  busy: boolean;
  startingScratch: boolean;
  onScratch: () => void;
  onReview: () => void;
  onImport: () => void;
}) {
  const options: Array<{ key: string; icon: ReactNode; title: string; desc: string; onClick: () => void; disabled?: boolean; hint?: string }> = [
    {
      key: "scratch",
      icon: <MessageSquarePlus className="h-4 w-4" aria-hidden />,
      title: "从零开始",
      desc: resumeBlank ? "一问一答，先写出第一版" : "新建一份空白简历，一问一答写出第一版",
      onClick: onScratch,
    },
    {
      key: "review",
      icon: <PenLine className="h-4 w-4" aria-hidden />,
      title: "完善这份简历",
      desc: "AI 先通读，再挑最值得补充的地方追问",
      onClick: onReview,
      disabled: resumeBlank,
      hint: resumeBlank ? "这份简历还是空的" : undefined,
    },
    {
      key: "import",
      icon: <FileUp className="h-4 w-4" aria-hidden />,
      title: "导入旧简历",
      desc: "粘贴文字或上传 PDF，整理成规范格式",
      onClick: onImport,
    },
  ];
  return (
    <div className="cc-start">
      <h2>和 AI 一起写简历</h2>
      <p>
        AI 会像面试官一样问你：做了什么、哪部分是你做的、结果如何、有没有数字。它只写你说过的事，没说清的会标成「待补」，由你来填。
      </p>
      <div className="cc-start-options">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className="cc-start-option"
            disabled={!aiReady || busy || option.disabled || (option.key === "scratch" && startingScratch)}
            title={option.hint}
            onClick={option.onClick}
          >
            <span className="cc-start-icon">
              {option.key === "scratch" && startingScratch ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : option.icon}
            </span>
            <span className="min-w-0">
              <span className="cc-start-title">{option.title}</span>
              <span className="cc-start-desc">{option.hint ?? option.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="cc-start-foot">你随时可以直接在右边改简历，AI 会以你的版本为准。</p>
    </div>
  );
}

function ImportPanel({ busy, onCancel, onSubmit }: { busy: boolean; onCancel: () => void; onSubmit: (text: string, source: "paste" | "pdf") => void }) {
  const [text, setText] = useState("");
  const [source, setSource] = useState<"paste" | "pdf">("paste");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/cocreate/import-pdf", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { text?: string; truncated?: boolean; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error || "没能读出 PDF 里的文字");
      setText(data.text);
      setSource("pdf");
      if (data.truncated) setError(`内容较长，只保留了前 ${IMPORT_LIMIT} 字`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "PDF 读取失败");
    } finally {
      setUploading(false);
    }
  };

  const length = text.trim().length;
  return (
    <div className="cc-import">
      <div className="cc-import-head">
        <span>导入旧简历</span>
        <button type="button" onClick={onCancel} aria-label="关闭导入">
          <X className="h-4 w-4" />
        </button>
      </div>
      <textarea
        autoFocus
        value={text}
        maxLength={IMPORT_LIMIT}
        onChange={(event) => {
          setText(event.target.value);
          setSource("paste");
        }}
        placeholder="把旧简历的文字粘贴到这里。AI 只会整理你给的内容，不会编造。"
        aria-label="旧简历文字"
      />
      {error && <p className="cc-import-error" role="alert">{error}</p>}
      <div className="cc-import-actions">
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={upload} />
        <button type="button" className="cc-ghost" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileUp className="h-3.5 w-3.5" aria-hidden />}
          {uploading ? "正在读取…" : "从 PDF 读取"}
        </button>
        <span className="cc-count">{length ? `${length} 字` : ""}</span>
        <button type="button" className="cc-primary" disabled={busy || length < 20} onClick={() => onSubmit(text, source)}>
          开始整理
        </button>
      </div>
    </div>
  );
}

export function ChatPanel({ controller, resumeBlank, onStartScratch, startingScratch }: ChatPanelProps) {
  const { loaded, loadError, reload, messages, edits, ai, live, busy, notice, dismissNotice, send, retry, cancel, revert, clear } =
    controller;
  const [draft, setDraft] = useState("");
  const [importing, setImporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const aiReady = !!ai?.configured;

  const editsByMessage = useMemo(() => {
    const map = new Map<string, EditRecord[]>();
    for (const edit of edits) {
      if (!edit.messageId) continue;
      map.set(edit.messageId, [...(map.get(edit.messageId) ?? []), edit]);
    }
    return map;
  }, [edits]);

  // 新内容到来时贴底；用户往上翻看时不打扰
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node && stickRef.current) node.scrollTop = node.scrollHeight;
  }, [messages, live?.text, live?.steps.length, edits.length, notice]);

  useLayoutEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 168)}px`;
  }, [draft]);

  useEffect(() => {
    stickRef.current = true;
  }, [messages.length]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || busy || !aiReady) return;
    setDraft("");
    const ok = await send({ kind: "chat", text });
    if (!ok) setDraft((current) => current || text);
    inputRef.current?.focus();
  };

  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");

  const renderAssistant = (message: ChatMessage) => {
    const isLive = live?.messageId === message.id;
    const text = isLive ? live.text : message.content;
    const steps = isLive ? live.steps : readSteps(message);
    const messageEdits = editsByMessage.get(message.id) ?? [];
    const error = message.status === "error" ? String(message.meta.error || "这一轮没有完成。") : null;
    return (
      <div key={message.id} className="cc-msg cc-msg-ai" aria-live={isLive ? "polite" : undefined}>
        <StepList steps={steps} />
        {text ? (
          <div className="cc-reply">
            <ReplyText text={text} />
            {isLive && <span className="cc-caret" aria-hidden />}
          </div>
        ) : isLive ? (
          <div className="cc-thinking" role="status">
            <span />
            <span />
            <span />
            <span className="sr-only">AI 正在思考</span>
          </div>
        ) : null}
        <EditList
          edits={messageEdits}
          busy={busy}
          onRevert={(id) => void revert("edit", id)}
          onRevertAll={() => void revert("message", message.id)}
        />
        {message.status === "cancelled" && <p className="cc-muted-line">已停止</p>}
        {error && (
          <div className="cc-error" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{error}</span>
            {message.id === lastAssistant?.id && (
              <button type="button" disabled={busy} onClick={() => void retry(message.id)}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                重试
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  let body: ReactNode;
  if (!loaded && loadError) {
    body = (
      <div className="cc-center">
        <AlertCircle className="h-5 w-5 text-zinc-400" aria-hidden />
        <p>{loadError}</p>
        <button type="button" className="cc-ghost" onClick={() => void reload()}>
          重新加载
        </button>
      </div>
    );
  } else if (!loaded) {
    body = (
      <div className="cc-loading" role="status" aria-label="正在载入对话">
        <span />
        <span />
        <span />
      </div>
    );
  } else if (!messages.length) {
    body = (
      <StartScreen
        resumeBlank={resumeBlank}
        aiReady={aiReady}
        busy={busy}
        startingScratch={startingScratch}
        onScratch={onStartScratch}
        onReview={() => void send({ kind: "review" })}
        onImport={() => setImporting(true)}
      />
    );
  } else {
    body = (
      <div className="cc-thread">
        {messages.map((message) => (message.role === "user" ? <UserBubble key={message.id} message={message} /> : renderAssistant(message)))}
      </div>
    );
  }

  return (
    <div className="cc-chat-inner" data-busy={busy || undefined}>
      <div className="cc-chat-head">
        <div className="flex min-w-0 items-center gap-2">
          <span className="cc-chat-title">AI 共创</span>
          {ai && (
            <span className="cc-model" data-ready={aiReady || undefined} title={aiReady ? `${ai.label} · ${ai.model}` : ai.error}>
              {aiReady ? ai.model || ai.label : "未配置模型"}
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button type="button" className="cc-icon-button" disabled={busy} onClick={() => setConfirmClear(true)} aria-label="清空对话" title="清空对话">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {ai && !aiReady && (
        <div className="cc-config">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">还没配置 AI 模型</p>
          <p>
            在服务端设置 <code>DEEPSEEK_API_KEY</code>，或用 <code>AI_PROVIDER</code> / <code>AI_MODEL</code> 选择其他模型，重启后即可使用。
          </p>
          {ai.error && <p className="cc-config-detail">{ai.error}</p>}
        </div>
      )}

      <div
        ref={scrollRef}
        className="cc-scroll"
        onScroll={(event) => {
          const node = event.currentTarget;
          stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
        }}
      >
        {body}
      </div>

      <div className="cc-composer-wrap">
        {notice && (
          <div className="cc-notice" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{notice}</span>
            <button type="button" onClick={dismissNotice} aria-label="关闭提示">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {importing ? (
          <ImportPanel
            busy={busy || !aiReady}
            onCancel={() => setImporting(false)}
            onSubmit={async (text, source) => {
              const ok = await send({ kind: "import", text, source });
              if (ok) setImporting(false);
            }}
          />
        ) : (
          <div className="cc-composer" data-disabled={!aiReady || undefined}>
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={4000}
              disabled={!aiReady || !loaded}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (isComposing(event)) return;
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder={messages.length ? "回答问题，或告诉 AI 要改哪里…" : "说说你自己，或先从上面选一种方式"}
              aria-label="给 AI 的消息"
            />
            <div className="cc-composer-bar">
              <button
                type="button"
                className="cc-ghost"
                disabled={!aiReady || busy}
                onClick={() => setImporting(true)}
                title="粘贴或上传旧简历"
              >
                <FileUp className="h-3.5 w-3.5" aria-hidden />
                导入
              </button>
              <span className="cc-hint">Enter 发送 · Shift+Enter 换行</span>
              {live ? (
                <button type="button" className="cc-send" onClick={() => void cancel()} aria-label="停止回复" title="停止">
                  <Square className="h-3 w-3 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  className="cc-send"
                  disabled={!draft.trim() || busy || !aiReady}
                  onClick={() => void submit()}
                  aria-label="发送"
                >
                  {controller.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="清空这份简历的对话？"
        message="只清空聊天记录和撤销记录，简历内容不会变。"
        confirmLabel="清空"
        confirmVariant="danger"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          void clear();
        }}
      />
    </div>
  );
}
