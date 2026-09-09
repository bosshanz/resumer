"use client";

import { useCallback, useRef, useState } from "react";
import { Download, Loader2, Upload, X } from "lucide-react";
import { MAX_BACKUP_BYTES, parseBackup, type ResumeBackup } from "@/lib/backup-format";
import { useFocusTrap } from "./use-focus-trap";

interface BackupDialogProps {
  onClose: () => void;
  onBeforeBackup: () => Promise<boolean>;
  onRestored: () => Promise<void>;
}

export function BackupDialog({ onClose, onBeforeBackup, onRestored }: BackupDialogProps) {
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<ResumeBackup | null>(null);
  const [filename, setFilename] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const close = useCallback(() => { if (!busyRef.current) onClose(); }, [onClose]);
  useFocusTrap({ open: true, containerRef: dialogRef, closeRef, onClose: close });

  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : "操作失败，请重试"); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function download() {
    await run(async () => {
      if (!await onBeforeBackup()) throw new Error("当前简历保存失败，未导出备份，请重试");
      const response = await fetch("/api/backup");
      if (!response.ok) throw new Error((await response.json()).error || "备份失败");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `resumer-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("备份已生成，请在浏览器下载中查看。");
    });
  }

  async function selectFile(file: File) {
    setBackup(null);
    setFilename("");
    await run(async () => {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("备份文件不能超过 100 MB");
      let value: unknown;
      try { value = JSON.parse(await file.text()); }
      catch { throw new Error("文件不是有效的 JSON 备份"); }
      const parsed = parseBackup(value);
      setBackup(parsed);
      setFilename(file.name);
    });
  }

  async function restore() {
    if (!backup) return;
    await run(async () => {
      const response = await fetch("/api/backup", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(backup),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "恢复失败");
      setBackup(null);
      setFilename("");
      setMessage(`已新增 ${result.restored.resumes} 份简历，恢复 ${result.restored.versions} 个历史版本。当前编辑内容保持不变。`);
      await onRestored();
    });
  }

  const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="backup-title" aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="backup-title" className="text-lg font-semibold">备份与恢复</h2>
          <button ref={closeRef} type="button" aria-label="关闭备份与恢复" disabled={busy} onClick={close} className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">导出当前账户的全部简历、照片、历史版本和变体关系，保存为一个 JSON 文件。</p>
        <button type="button" disabled={busy} onClick={download} className={buttonClass}><Download className="h-4 w-4" />下载备份</button>
        <div className="my-5 border-t border-zinc-200 dark:border-zinc-800" />
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">从备份新增简历，不覆盖已有内容。重复恢复会再新增一份。支持最大 100 MB 的文件。</p>
        <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" aria-label="选择备份文件" disabled={busy}
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void selectFile(file); }} />
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={buttonClass}><Upload className="h-4 w-4" />选择备份文件</button>
        {backup && <div className="mt-3 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
          <p className="break-all font-medium">{filename}</p>
          <p className="mt-1">{backup.resumes.length} 份简历 · {backup.versions.length} 个历史版本 · {backup.photos.length} 张照片</p>
          <button type="button" disabled={busy || backup.resumes.length === 0} onClick={restore} className={`${buttonClass} mt-3`}>确认新增恢复</button>
        </div>}
        {busy && <p role="status" className="mt-4 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />正在处理，请稍候…</p>}
        {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {message && <p role="status" className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
        <p className="mt-4 text-xs text-zinc-500">备份包含完整内容（含隐藏区块），请妥善保存。登录凭据及尚未另存的 AI 改写会话不包含在内。</p>
      </div>
    </div>
  );
}
