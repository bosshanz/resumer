"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Preview } from "./preview";
import { TemplateSelector } from "./template-selector";
import { ThemePanel } from "./theme-panel";
import { Resume, ThemeVariables } from "@/lib/types";
import { getDefaultTheme } from "@/lib/templates";
import {
  Download,
  FileUp,
  FileDown,
  LogOut,
  Palette,
  Eye,
  PenLine,
  Columns,
  X,
  Loader2,
  UserCircle,
  Trash2,
} from "lucide-react";
import Image from "next/image";

interface EditorProps {
  initialResume: Resume;
}

type SaveStatus = "saved" | "saving" | "unsaved" | "error";
type FocusMode = "split" | "edit" | "preview";

export function Editor({ initialResume }: EditorProps) {
  const { data: session } = useSession();
  const [title, setTitleState] = useState(initialResume.title);
  const [content, setContentState] = useState(initialResume.content);
  const [templateId, setTemplateIdState] = useState(initialResume.templateId);
  const [themeVariables, setThemeVariablesState] = useState<ThemeVariables>(
    initialResume.themeVariables && Object.keys(initialResume.themeVariables).length > 0
      ? initialResume.themeVariables
      : getDefaultTheme(initialResume.templateId)
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [isExporting, setIsExporting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [focusMode, setFocusMode] = useState<FocusMode>("split");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [photo, setPhotoState] = useState<string | undefined>(initialResume.photo);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const markUnsaved = useCallback(() => setSaveStatus("unsaved"), []);
  const setContent = useCallback((v: string) => { setContentState(v); markUnsaved(); }, [markUnsaved]);
  const setTitle = useCallback((v: string) => { setTitleState(v); markUnsaved(); }, [markUnsaved]);
  const setTemplateId = useCallback((v: string) => { setTemplateIdState(v); markUnsaved(); }, [markUnsaved]);
  const setThemeVariables = useCallback((v: ThemeVariables) => { setThemeVariablesState(v); markUnsaved(); }, [markUnsaved]);
  const setPhoto = useCallback((v: string | undefined) => { setPhotoState(v); markUnsaved(); }, [markUnsaved]);

  const saveResume = useCallback(
    async (data: Partial<Pick<Resume, "title" | "content" | "templateId" | "themeVariables" | "photo">>) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/resumes/${initialResume.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Save failed");
        setSaveStatus("saved");
      } catch (err) {
        console.error(err);
        setSaveStatus("error");
      }
    },
    [initialResume.id]
  );

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveResume({ title, content, templateId, themeVariables, photo });
    }, 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, content, templateId, themeVariables, photo, saveResume]);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, templateId, themeVariables, photo }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (title || "resume").replace(/[^\w一-龥\-_. ]/g, "_");
      a.download = `${safeName}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("PDF 导出失败，请检查浏览器控制台");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (title || "resume").replace(/[^\w一-龥\-_. ]/g, "_");
    a.download = `${safeName}.md`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImportMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setContent(String(event.target?.result || ""));
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
    reader.onload = (event) => setPhoto(String(event.target?.result || ""));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearPhoto = () => setPhoto("");

  const resetTheme = () => setThemeVariables(getDefaultTheme(templateId));

  const showEditor = focusMode === "split" || focusMode === "edit";
  const showPreview = focusMode === "split" || focusMode === "preview";

  // Keyboard shortcut: Cmd/Ctrl + S to force save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveResume({ title, content, templateId, themeVariables, photo });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [title, content, templateId, themeVariables, photo, saveResume]);

  const saveDot = useMemo(() => {
    switch (saveStatus) {
      case "saved":
        return { color: "bg-emerald-500", label: "已保存" };
      case "saving":
        return { color: "bg-amber-400 animate-pulse", label: "保存中" };
      case "unsaved":
        return { color: "bg-zinc-400", label: "待保存" };
      case "error":
        return { color: "bg-red-500", label: "保存失败" };
    }
  }, [saveStatus]);

  return (
    <div className="flex h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-zinc-200 bg-white/80 px-4 py-2 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="flex min-w-0 items-center gap-2">
          <span className="select-none text-base font-semibold tracking-tight">Resumer</span>
          <span
            className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${saveDot.color}`}
            title={saveDot.label}
            aria-label={saveDot.label}
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="未命名简历"
            className="min-w-0 max-w-[18ch] truncate border-0 bg-transparent px-1 py-0.5 text-sm text-zinc-700 outline-none placeholder:text-zinc-400 hover:bg-zinc-100/70 focus:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:focus:bg-zinc-800"
          />
        </div>

        <div className="hidden items-center gap-1.5 sm:flex">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
          {photo ? (
            <div className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt=""
                className="h-7 w-7 rounded object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
              />
              <button
                type="button"
                onClick={clearPhoto}
                title="删除照片"
                className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-800 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100 dark:bg-zinc-700"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              title="上传照片"
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <UserCircle className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="hidden md:block">
          <TemplateSelector value={templateId} onChange={setTemplateId} />
        </div>

        <div className="flex-1" />

        <FocusToggle value={focusMode} onChange={setFocusMode} />

        <div className="mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-800" aria-hidden />

        <button
          type="button"
          onClick={() => setDrawerOpen((v) => !v)}
          aria-pressed={drawerOpen}
          className={[
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
            drawerOpen
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
          ].join(" ")}
        >
          <Palette className="h-4 w-4" />
          样式
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown"
          onChange={handleImportMarkdown}
          className="hidden"
        />
        <IconButton title="导入 Markdown" onClick={() => fileInputRef.current?.click()}>
          <FileUp className="h-4 w-4" />
        </IconButton>
        <IconButton title="导出 Markdown" onClick={handleExportMarkdown}>
          <FileDown className="h-4 w-4" />
        </IconButton>

        <button
          onClick={handleExportPdf}
          disabled={isExporting}
          className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          导出 PDF
        </button>

        {session?.user ? (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title={session.user.name || ""}
            >
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt=""
                  width={28}
                  height={28}
                  className="rounded-full"
                  unoptimized
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium dark:bg-zinc-800">
                  {(session.user.name || "U").charAt(0).toUpperCase()}
                </span>
              )}
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-md border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                  <div className="truncate text-sm font-medium">{session.user.name}</div>
                  {session.user.email && (
                    <div className="truncate text-xs text-zinc-500">{session.user.email}</div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <LogOut className="h-3.5 w-3.5" /> 退出登录
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => signIn("github")}
            className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            登录
          </button>
        )}
      </header>

      <main className="relative flex flex-1 overflow-hidden">
        {showEditor && (
          <div
            className={[
              "flex flex-col border-r border-zinc-200 dark:border-zinc-800",
              showPreview ? "w-1/2" : "w-full",
            ].join(" ")}
          >
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              className="flex-1 resize-none bg-white px-6 py-5 font-mono text-[13.5px] leading-[1.65] text-zinc-800 outline-none placeholder:text-zinc-400 dark:bg-zinc-950 dark:text-zinc-200"
              placeholder={"---\nname: 你的名字\n---\n\n## 工作经历\n..."}
            />
          </div>
        )}

        {showPreview && (
          <div className={`flex flex-col ${showEditor ? "w-1/2" : "w-full"}`}>
            <div className="flex-1 overflow-auto bg-zinc-200/60 px-6 py-8 dark:bg-zinc-900">
              <Preview
                content={content}
                templateId={templateId}
                themeVariables={themeVariables}
                photo={photo}
                scale={showEditor ? 0.82 : 1}
              />
            </div>
          </div>
        )}

        {/* Style drawer */}
        <aside
          className={[
            "absolute right-0 top-0 z-20 flex h-full w-[320px] flex-col border-l border-zinc-200 bg-white shadow-xl transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-900",
            drawerOpen ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
          aria-hidden={!drawerOpen}
        >
          <ThemePanel value={themeVariables} onChange={setThemeVariables} onReset={resetTheme} />
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="absolute right-2 top-2.5 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </aside>
      </main>
    </div>
  );
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

function FocusToggle({
  value,
  onChange,
}: {
  value: FocusMode;
  onChange: (v: FocusMode) => void;
}) {
  const opts: { id: FocusMode; icon: React.ReactNode; title: string }[] = [
    { id: "edit", icon: <PenLine className="h-3.5 w-3.5" />, title: "仅编辑器" },
    { id: "split", icon: <Columns className="h-3.5 w-3.5" />, title: "分屏" },
    { id: "preview", icon: <Eye className="h-3.5 w-3.5" />, title: "仅预览" },
  ];
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          title={o.title}
          className={[
            "flex h-7 w-7 items-center justify-center rounded transition-colors",
            value === o.id
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
          ].join(" ")}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
