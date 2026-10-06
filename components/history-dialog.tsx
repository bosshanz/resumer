"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History, Loader2, RotateCcw, X } from "lucide-react";
import { Preview } from "./preview";
import { useFocusTrap } from "./use-focus-trap";
import type { Resume, ThemeVariables } from "@/lib/types";

interface VersionListItem {
  id: string;
  title: string;
  createdAt: string;
  contentPreview: string;
}

interface VersionDetail {
  id: string;
  title: string;
  createdAt: string;
  content: string;
  templateId: string;
  themeVariables: ThemeVariables;
  photo?: string;
}

interface HistoryDialogProps {
  resumeId: string;
  onClose: () => void;
  onBeforeRestore: () => Promise<boolean>;
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

export function HistoryDialog({ resumeId, onClose, onBeforeRestore, onRestore }: HistoryDialogProps) {
  const [versions, setVersions] = useState<VersionListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [listRequest, setListRequest] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VersionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailMissing, setDetailMissing] = useState(false);
  const [detailRequest, setDetailRequest] = useState(0);
  const [restoreError, setRestoreError] = useState("");
  const [restoring, setRestoring] = useState(false);
  const restoringRef = useRef(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const close = useCallback(() => {
    if (!restoringRef.current) onCloseRef.current();
  }, []);
  useFocusTrap({ open: true, containerRef: dialogRef, closeRef: closeButtonRef, onClose: close });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListLoading(true);
      setListError("");
      try {
        const res = await fetch(`/api/resumes/${resumeId}/versions`, { cache: "no-store" });
        if (!res.ok) throw new Error("List failed");
        const data = await res.json();
        if (cancelled) return;
        const next = data.versions as VersionListItem[];
        setVersions(next);
        setSelectedId((current) => next.some((item) => item.id === current) ? current : next[0]?.id ?? null);
      } catch {
        if (!cancelled) setListError("历史版本未能加载。当前编辑内容未改变，请重试。");
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [resumeId, listRequest]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      setDetail(null);
      setDetailLoading(true);
      setDetailError("");
      setDetailMissing(false);
      setRestoreError("");
      try {
        const res = await fetch(`/api/resumes/${resumeId}/versions/${selectedId}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) {
            setDetailMissing(true);
            setDetailError("此版本已不存在。请刷新历史列表后选择其他版本。");
          }
          return;
        }
        if (!res.ok) throw new Error("Detail failed");
        const data = await res.json();
        if (!cancelled) setDetail(data.version as VersionDetail);
      } catch {
        if (!cancelled) setDetailError("版本预览未能加载。当前编辑内容未改变，请重试。");
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [resumeId, selectedId, detailRequest]);

  async function handleRestore() {
    if (!selectedId || !detail || detail.id !== selectedId || restoringRef.current) return;
    restoringRef.current = true;
    setRestoring(true);
    setRestoreError("");
    try {
      const saved = await onBeforeRestore();
      if (!saved) {
        setRestoreError("当前编辑未能保存，内容已保留。请重试保存后再恢复。");
        return;
      }
      const res = await fetch(`/api/resumes/${resumeId}/versions/${selectedId}/restore`, { method: "POST" });
      if (res.status === 404) {
        setDetailMissing(true);
        setRestoreError("此版本已不存在。当前编辑内容已保存，请刷新历史列表。");
        return;
      }
      if (!res.ok) throw new Error("Restore failed");
      const data = await res.json();
      onRestore(data.resume as Resume);
    } catch {
      setRestoreError("恢复未完成，当前编辑内容已保留。请重试。");
    } finally {
      restoringRef.current = false;
      setRestoring(false);
    }
  }

  function refreshList() {
    setListRequest((value) => value + 1);
    setDetailRequest((value) => value + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm dark:bg-zinc-950/60"
        onClick={close} aria-hidden />
      <div ref={dialogRef} role="dialog" data-testid="history-dialog" aria-modal="true"
        aria-labelledby="history-title" aria-busy={restoring}
        className="relative flex h-[min(88vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:px-5">
          <History className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          <h3 id="history-title" className="flex-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">历史版本</h3>
          <button ref={closeButtonRef} type="button" onClick={close} disabled={restoring}
            aria-label="关闭" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="max-h-44 flex-shrink-0 overflow-y-auto border-b border-zinc-200 p-2 dark:border-zinc-800 md:max-h-none md:w-64 md:border-b-0 md:border-r lg:w-72">
            {listLoading ? (
              <p className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />加载中…</p>
            ) : listError ? (
              <div className="px-3 py-6 text-center text-sm text-red-600 dark:text-red-400">
                <p>{listError}</p>
                <button type="button" onClick={refreshList} className="mt-3 rounded-md border border-current px-3 py-1.5">重试加载</button>
              </div>
            ) : versions.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">暂无历史版本。手动保存会立即留档，平时编辑每 5 分钟自动留档一次。</p>
            ) : versions.map((version) => (
              <button key={version.id} type="button" data-testid="history-version-item"
                aria-pressed={selectedId === version.id} disabled={restoring}
                onClick={() => setSelectedId(version.id)}
                className={"mb-1 w-full rounded-lg px-3 py-2.5 text-left disabled:opacity-50 " + (selectedId === version.id ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60")}>
                <span className="block break-words text-sm font-medium text-zinc-800 dark:text-zinc-200">{version.title?.trim() || "未命名简历"}</span>
                <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{relativeTime(version.createdAt)}</span>
                <span className="mt-1 block truncate text-xs text-zinc-500 dark:text-zinc-400">{version.contentPreview}</span>
              </button>
            ))}
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-zinc-100 px-3 py-4 dark:bg-zinc-950 sm:px-5" aria-label="历史版本只读预览">
            {detailLoading ? (
              <p className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />加载预览…</p>
            ) : detailError ? (
              <div className="py-12 text-center text-sm text-red-600 dark:text-red-400">
                <p>{detailError}</p>
                <button type="button" onClick={detailMissing ? refreshList : () => setDetailRequest((value) => value + 1)}
                  className="mt-3 rounded-md border border-current px-3 py-1.5">{detailMissing ? "刷新历史列表" : "重试预览"}</button>
              </div>
            ) : detail && detail.id === selectedId ? (
              <>
                <p className="mb-3 text-center text-xs text-zinc-600 dark:text-zinc-400">{detail.title || "未命名简历"} · 只读预览</p>
                <Preview content={detail.content} templateId={detail.templateId}
                  themeVariables={detail.themeVariables} photo={detail.photo} />
              </>
            ) : !listLoading && !listError ? (
              <p className="py-12 text-center text-sm text-zinc-500">选择一个版本查看完整简历。</p>
            ) : null}
          </div>
        </div>

        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:px-5">
          {restoreError && <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">{restoreError} {detailMissing && <button type="button" onClick={refreshList} className="underline">刷新历史列表</button>}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">恢复前会先把当前内容留档，恢复错了可以从历史退回。</p>
            <button type="button" data-testid="restore-version-button" onClick={handleRestore}
              disabled={!detail || detail.id !== selectedId || detailMissing || restoring} className="flex min-h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
              {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {restoring ? "正在恢复…" : "恢复此版本"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
