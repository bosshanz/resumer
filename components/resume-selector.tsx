"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
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
  compact?: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDuplicate: () => void;
  onDelete: (id: string) => void;
}

export function ResumeSelector({
  resumes,
  currentId,
  disabled,
  compact = false,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
}: ResumeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const triggerId = useId();
  const pendingFocusRef = useRef<"first" | "last" | null>(null);

  const current = resumes.find((r) => r.id === currentId);
  const displayTitle = current?.title?.trim() || "未命名简历";
  const currentIndex = resumes.findIndex((resume) => resume.id === currentId);

  function getNavigationItems() {
    return Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-menu-navigation-item="true"]',
      ) ?? [],
    );
  }

  function closeMenu(restoreFocus = false) {
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
    setOpen(false);
  }

  function focusNavigationItem(index: number) {
    const items = getNavigationItems();
    if (items.length === 0) return;

    const nextIndex = Math.max(0, Math.min(index, items.length - 1));
    setActiveIndex(nextIndex);
    items[nextIndex]?.focus();
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    const items = getNavigationItems();
    if (items.length === 0) return;

    const focusedIndex = items.findIndex((item) => item === document.activeElement);
    const currentNavigationIndex = focusedIndex >= 0 ? focusedIndex : activeIndex;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusNavigationItem((currentNavigationIndex + 1) % items.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusNavigationItem((currentNavigationIndex - 1 + items.length) % items.length);
        break;
      case "Home":
        event.preventDefault();
        focusNavigationItem(0);
        break;
      case "End":
        event.preventDefault();
        focusNavigationItem(items.length - 1);
        break;
      default:
        break;
    }
  }

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscapeOutsideMenu(event: KeyboardEvent) {
      if (event.key === "Escape" && !containerRef.current?.contains(event.target as Node)) {
        closeMenu(true);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscapeOutsideMenu);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeOutsideMenu);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-menu-navigation-item="true"]',
      ) ?? [],
    );
    if (items.length === 0) return;

    const pendingFocus = pendingFocusRef.current;
    pendingFocusRef.current = null;
    const nextIndex =
      pendingFocus === "first"
        ? 0
        : pendingFocus === "last"
          ? items.length - 1
          : Math.max(0, Math.min(currentIndex, items.length - 1));

    setActiveIndex(nextIndex);
    items[nextIndex]?.focus();
  }, [open, currentIndex]);

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled || open) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      pendingFocusRef.current = event.key === "ArrowDown" ? "first" : "last";
      setOpen(true);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        ref={triggerRef}
        id={triggerId}
        data-testid="resume-selector-button"
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={compact ? `切换简历，当前：${displayTitle}` : undefined}
        title={compact ? "切换简历" : `当前简历：${displayTitle}`}
        className={[
          "flex min-h-8 min-w-8 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500",
          compact ? "max-w-none" : "max-w-[200px]",
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
        {!compact && <span className="truncate">{displayTitle}</span>}
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          aria-orientation="vertical"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
          data-testid="resume-list"
          className="absolute right-0 top-full z-40 mt-1.5 w-[min(280px,calc(100vw-24px))] rounded-lg border border-zinc-200 bg-white py-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div role="presentation" className="max-h-[320px] overflow-y-auto px-1.5">
            {resumes.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                暂无简历
              </div>
            ) : (
              resumes.map((resume, resumeIndex) => {
                const active = resume.id === currentId;
                const title = resume.title?.trim() || "未命名简历";
                return (
                  <div
                    key={resume.id}
                    role="presentation"
                    className={[
                      "group flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm",
                      active
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      data-menu-navigation-item="true"
                      data-testid="resume-item"
                      tabIndex={activeIndex === resumeIndex ? 0 : -1}
                      onClick={() => {
                        closeMenu(true);
                        onSelect(resume.id);
                      }}
                      onFocus={() => setActiveIndex(resumeIndex)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <FileText className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400 dark:text-zinc-500" />
                      <span className="truncate">{title}</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      aria-label={`删除 ${title}`}
                      title={`删除 ${title}`}
                      data-testid="delete-resume-button"
                      onClick={() => {
                        closeMenu(true);
                        onDelete(resume.id);
                      }}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-zinc-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 group-hover:opacity-100 dark:text-zinc-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div
            role="presentation"
            className="mt-1 border-t border-zinc-200 px-1.5 pt-1 dark:border-zinc-800"
          >
            <button
              type="button"
              role="menuitem"
              data-menu-navigation-item="true"
              tabIndex={activeIndex === resumes.length ? 0 : -1}
              data-testid="create-resume-button"
              onClick={() => {
                closeMenu(true);
                onCreate();
              }}
              onFocus={() => setActiveIndex(resumes.length)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              <Plus className="h-3.5 w-3.5" />
              新建简历
            </button>
            <button
              type="button"
              role="menuitem"
              data-menu-navigation-item="true"
              tabIndex={activeIndex === resumes.length + 1 ? 0 : -1}
              data-testid="duplicate-resume-button"
              onClick={() => {
                closeMenu(true);
                onDuplicate();
              }}
              onFocus={() => setActiveIndex(resumes.length + 1)}
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
