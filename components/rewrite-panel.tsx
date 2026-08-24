"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Resume } from "@/lib/types";
import { editorDrawerClassName } from "@/lib/editor-drawer";
import { MIN_BRIEF_CHARS } from "@/lib/rewrite/brief";
import { RewriteSession } from "@/lib/rewrite/types";

export interface RewritePreviewState {
  generating: boolean;
  ready: boolean;
  draftContent: string;
}

interface RewritePanelProps {
  open: boolean;
  resumeId: string;
  onClose: () => void;
  onBeforeGenerate: () => Promise<boolean>;
  onApplied: (resume: Resume) => Promise<void>;
  onPreviewState: (state: RewritePreviewState | null) => void;
}

export function RewritePanel({
  open,
  resumeId,
  onClose,
  onBeforeGenerate,
  onApplied,
  onPreviewState,
}: RewritePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const inFlightRef = useRef(false);
  const [brief, setBrief] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [rewrite, setRewrite] = useState<RewriteSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generating = loading || rewrite?.status === "generating";
  const ready = rewrite?.status === "ready";

  const applyLoadedSession = useCallback((next: RewriteSession | null) => {
    setRewrite(next);
    if (next?.brief) setBrief(next.brief);
    setError(next?.status === "error" ? next.errorMessage || "生成建议稿失败，请重试" : null);
    setFollowUp("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/rewrites?resumeId=${encodeURIComponent(resumeId)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        applyLoadedSession((data.rewrite || null) as RewriteSession | null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [open, resumeId, applyLoadedSession]);

  useEffect(() => {
    if (!open) {
      onPreviewState(null);
      return;
    }
    onPreviewState({
      generating,
      ready: Boolean(ready),
      draftContent: rewrite?.draftContent || "",
    });
  }, [open, generating, ready, rewrite, onPreviewState]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => closeRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [open, onClose]);

  const generate = async () => {
    if (inFlightRef.current || generating) return;
    inFlightRef.current = true;
    setError(null);
    const saved = await onBeforeGenerate();
    if (!saved) {
      inFlightRef.current = false;
      setError("请先保存当前简历，再生成建议稿");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/rewrites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, brief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      setRewrite(data.rewrite as RewriteSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
      const res = await fetch(`/api/rewrites?resumeId=${encodeURIComponent(resumeId)}`);
      if (res.ok) {
        const data = await res.json();
        applyLoadedSession((data.rewrite || null) as RewriteSession | null);
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const continueDraft = async () => {
    if (!rewrite || inFlightRef.current || generating) return;
    inFlightRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/rewrites/${rewrite.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: followUp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "再改一版失败");
      setRewrite(data.rewrite as RewriteSession);
      setFollowUp("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "再改一版失败");
      const res = await fetch(`/api/rewrites?resumeId=${encodeURIComponent(resumeId)}`);
      if (res.ok) {
        const data = await res.json();
        applyLoadedSession((data.rewrite || null) as RewriteSession | null);
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!rewrite) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/rewrites/${rewrite.id}/apply`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "另存失败");
      await onApplied(data.resume as Resume);
    } catch (err) {
      setError(err instanceof Error ? err.message : "另存失败");
    } finally {
      setApplying(false);
    }
  };

  const discard = async () => {
    if (!rewrite) return;
    setError(null);
    try {
      const res = await fetch(`/api/rewrites/${rewrite.id}/discard`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "放弃失败");
      setRewrite(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "放弃失败");
    }
  };

  return (
    <aside
      ref={panelRef}
      id="rewrite-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rewrite-panel-title"
      className={editorDrawerClassName(open, ready ? "sm:w-[320px]" : "sm:w-[380px]")}
      inert={!open}
    >
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
            {ready ? "建议稿校对" : "从底稿分叉"}
          </p>
          <h2 id="rewrite-panel-title" className="mt-1 text-base font-semibold tracking-tight">
            改写
          </h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:hover:bg-zinc-800"
          aria-label="关闭改写面板"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
        {ready ? (
          <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm leading-6 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {brief}
          </p>
        ) : (
          <label className="block">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">改写要求</span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              disabled={generating}
              rows={8}
              className="mt-1.5 w-full resize-y rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              placeholder={"可以贴一份 JD，也可以只写一句方向，例如：\n更偏后端\n把参与和主导写清楚\n删空话，保留有证据的成果"}
            />
            <span className="mt-1.5 block text-xs leading-5 text-zinc-500">
              建议稿会显示在右侧预览。主导次数不能比底稿多。
            </span>
          </label>
        )}

        {!ready ? (
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating || brief.trim().length < MIN_BRIEF_CHARS}
            className="flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {generating ? "正在改写…" : "生成建议稿"}
          </button>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {ready && rewrite ? (
          <div className="space-y-4">
            <section aria-labelledby="rewrite-notes-title">
              <h3 id="rewrite-notes-title" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                变更说明
              </h3>
              <ol className="mt-2 border-l-2 border-zinc-900 pl-3 dark:border-zinc-100">
                {rewrite.changeNotes.length === 0 ? (
                  <li className="py-1 text-sm text-zinc-500">模型没有给出变更说明。</li>
                ) : (
                  rewrite.changeNotes.map((note, index) => (
                    <li key={`${index}-${note}`} className="flex gap-2 py-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                      <span className="w-4 shrink-0 font-mono text-[11px] text-zinc-400">{String(index + 1).padStart(2, "0")}</span>
                      <span>{note}</span>
                    </li>
                  ))
                )}
              </ol>
            </section>

            {rewrite.pendingItems.length > 0 ? (
              <section aria-labelledby="rewrite-pending-title" className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
                <h3 id="rewrite-pending-title" className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  待补项
                </h3>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-amber-900 dark:text-amber-200">
                  {rewrite.pendingItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <label className="block">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">针对这份建议再改一版</span>
              <textarea
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                disabled={generating}
                rows={3}
                className="mt-1.5 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
                placeholder="例如：再短一点，更偏后端。"
              />
            </label>
            <button
              type="button"
              onClick={() => void continueDraft()}
              disabled={generating || followUp.trim().length === 0}
              className="flex min-h-9 w-full items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              再改一版
            </button>
          </div>
        ) : null}
      </div>

      {ready ? (
        <div className="flex gap-2 border-t border-zinc-200 p-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => void discard()}
            disabled={generating || applying}
            className="min-h-9 flex-1 rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            放弃
          </button>
          <button
            type="button"
            onClick={() => void apply()}
            disabled={generating || applying}
            className="flex min-h-9 flex-[1.4] items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            另存为新简历
          </button>
        </div>
      ) : null}
    </aside>
  );
}
