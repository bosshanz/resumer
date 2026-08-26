"use client";

import { useEffect, useRef, useState } from "react";
import { History, Loader2, RotateCcw, X } from "lucide-react";
import { Resume } from "@/lib/types";

interface VersionListItem {
  id: string;
  title: string;
  createdAt: string;
  contentPreview: string;
}

interface HistoryDialogProps {
  resumeId: string;
  onClose: () => void;
  onRestore: (resume: Resume) => void;
}

function parseDbTime(value: string): number {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const timestamp = Date.parse(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function relativeTime(createdAt: string): string {
  const timestamp = parseDbTime(createdAt);
  if (!timestamp) return createdAt;
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const time = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours < 48) return `昨天 ${pad(time.getHours())}:${pad(time.getMinutes())}`;
  return `${pad(time.getMonth() + 1)}-${pad(time.getDate())} ${pad(time.getHours())}:${pad(time.getMinutes())}`;
}

export function HistoryDialog({ resumeId, onClose, onRestore }: HistoryDialogProps) {
  const [versions, setVersions] = useState<VersionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // 挂载即加载；组件由父级条件渲染，关闭即卸载并丢弃状态
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/resumes/${resumeId}/versions`);
        if (!res.ok) throw new Error("Failed to load versions");
        const data = await res.json();
        if (cancelled) return;
        setVersions(data.versions as VersionListItem[]);
        setIsLoading(false);
      } catch {
        if (cancelled) return;
        setError("加载历史版本失败，请重试");
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumeId]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  async function handleRestore(versionId: string) {
    setRestoringId(versionId);
    try {
      const res = await fetch(`/api/resumes/${resumeId}/versions/${versionId}/restore`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Restore failed");
      const data = await res.json();
      onRestore(data.resume as Resume);
    } catch (err) {
      console.error(err);
      setError("恢复失败，请重试");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm dark:bg-zinc-950/60"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        data-testid="history-dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <History className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          <h3 id="history-title" className="flex-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            历史版本
          </h3>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-[120px] flex-1 overflow-y-auto px-3 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-zinc-500 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中…
            </div>
          ) : error && versions.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : versions.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              暂无历史版本。手动保存（Cmd/Ctrl + S）会立即留档，
              平时编辑每 5 分钟自动留档一次，每份简历保留最近 20 份。
            </div>
          ) : (
            versions.map((version) => (
              <div
                key={version.id}
                data-testid="history-version-item"
                className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {version.title?.trim() || "未命名简历"}
                    </span>
                    <span className="flex-shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                      {relativeTime(version.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {version.contentPreview}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="restore-version-button"
                  disabled={restoringId !== null}
                  onClick={() => handleRestore(version.id)}
                  className="flex min-h-8 flex-shrink-0 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {restoringId === version.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  恢复
                </button>
              </div>
            ))
          )}
        </div>

        {error && versions.length > 0 && (
          <p className="border-t border-zinc-200 px-5 py-2 text-xs text-red-600 dark:border-zinc-800 dark:text-red-400">
            {error}
          </p>
        )}
        <p className="border-t border-zinc-200 px-5 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          恢复前会先把当前内容留档，恢复错了可以再次从历史退回。
        </p>
      </div>
    </div>
  );
}
