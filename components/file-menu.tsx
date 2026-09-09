"use client";

import { useCallback, useRef, useState } from "react";
import {
  FileDown,
  FileUp,
  History,
  ImagePlus,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useMenuDismiss } from "./use-menu-dismiss";

interface FileMenuProps {
  hasPhoto: boolean;
  onImportMarkdown: (content: string) => void;
  onExportMarkdown: () => void;
  onOpenHistory: () => void;
  onOpenBackup: () => void;
  onChangePhoto: (dataUrl: string) => void;
  onRemovePhoto: () => void;
}

// 顶栏「更多操作」菜单：导入/导出 Markdown、历史版本、照片上传与删除。
// 隐藏的文件输入也收在这里，选完文件把结果通过回调交回编辑器
export function FileMenu({
  hasPhoto,
  onImportMarkdown,
  onExportMarkdown,
  onOpenHistory,
  onOpenBackup,
  onChangePhoto,
  onRemovePhoto,
}: FileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const markdownInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  // 稳定引用，避免 useMenuDismiss 的 effect 每次渲染重挂监听器
  const close = useCallback(() => setOpen(false), []);
  useMenuDismiss(open, containerRef, buttonRef, close);

  const handleImportMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => onImportMarkdown(String(event.target?.result || ""));
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("请上传图片文件");
      e.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("图片大小不能超过 2MB");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => onChangePhoto(String(event.target?.result || ""));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={markdownInputRef}
        type="file"
        accept=".md,.markdown,text/markdown"
        onChange={handleImportMarkdown}
        className="hidden"
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoChange}
        className="hidden"
      />
      <IconButton
        buttonRef={buttonRef}
        title="更多操作"
        ariaExpanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </IconButton>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-[190px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <MenuButton
            icon={<FileUp className="h-4 w-4" />}
            label="导入 Markdown"
            onClick={() => {
              close();
              markdownInputRef.current?.click();
            }}
          />
          <MenuButton
            icon={<FileDown className="h-4 w-4" />}
            label="导出 Markdown"
            onClick={() => {
              close();
              onExportMarkdown();
            }}
          />
          <MenuButton
            icon={<History className="h-4 w-4" />}
            label="历史版本…"
            onClick={() => {
              close();
              onOpenHistory();
            }}
          />
          <MenuButton
            icon={<FileDown className="h-4 w-4" />}
            label="备份与恢复…"
            onClick={() => { close(); onOpenBackup(); }}
          />
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
          <MenuButton
            icon={<ImagePlus className="h-4 w-4" />}
            label={hasPhoto ? "更换照片" : "上传照片"}
            onClick={() => {
              close();
              photoInputRef.current?.click();
            }}
          />
          {hasPhoto && (
            <MenuButton
              icon={<Trash2 className="h-4 w-4" />}
              label="删除照片"
              danger
              onClick={() => {
                close();
                onRemovePhoto();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function IconButton({
  buttonRef,
  title,
  onClick,
  children,
  ariaExpanded,
}: {
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  ariaExpanded?: boolean;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-haspopup={ariaExpanded === undefined ? undefined : "menu"}
      aria-expanded={ariaExpanded}
      className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={[
        "flex min-h-9 w-full items-center gap-2 px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500",
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
