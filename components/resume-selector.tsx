"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Copy, Trash2, FileText, Loader2 } from "lucide-react";

export interface ResumeListItem {
  id: string;
  title: string;
  updatedAt: string;
}

interface ResumeSelectorProps {
  resumes: ResumeListItem[];
  currentId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDuplicate: () => void;
  onDelete: (id: string) => void;
}

export function ResumeSelector({
  resumes,
  currentId,
  disabled,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
}: ResumeSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = resumes.find((r) => r.id === currentId);
  const displayTitle = current?.title?.trim() || "未命名简历";

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="resume-selector-button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          "flex max-w-[200px] items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium transition-colors",
          disabled
            ? "cursor-not-allowed text-zinc-400"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
        ].join(" ")}
      >
        {disabled ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ChevronDown
            className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
        <span className="truncate">{displayTitle}</span>
      </button>

      {open && (
        <div
          role="listbox"
          data-testid="resume-list"
          className="absolute left-0 top-full z-40 mt-1.5 w-[280px] rounded-lg border border-zinc-200 bg-white py-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="max-h-[320px] overflow-y-auto px-1.5">
            {resumes.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                暂无简历
              </div>
            ) : (
              resumes.map((resume) => {
                const active = resume.id === currentId;
                const title = resume.title?.trim() || "未命名简历";
                return (
                  <div
                    key={resume.id}
                    role="option"
                    data-testid="resume-item"
                    aria-selected={active}
                    className={[
                      "group flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm",
                      active
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onSelect(resume.id);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <FileText className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400 dark:text-zinc-500" />
                      <span className="truncate">{title}</span>
                    </button>

                    <button
                      type="button"
                      title="删除"
                      data-testid="delete-resume-button"
                      onClick={() => {
                        setOpen(false);
                        onDelete(resume.id);
                      }}
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-zinc-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:text-zinc-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-1 border-t border-zinc-200 px-1.5 pt-1 dark:border-zinc-800">
            <button
              type="button"
              data-testid="create-resume-button"
              onClick={() => {
                setOpen(false);
                onCreate();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              <Plus className="h-3.5 w-3.5" />
              新建简历
            </button>
            <button
              type="button"
              data-testid="duplicate-resume-button"
              onClick={() => {
                setOpen(false);
                onDuplicate();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              <Copy className="h-3.5 w-3.5" />
              复制当前简历
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
