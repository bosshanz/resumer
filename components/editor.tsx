"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Preview } from "./preview";
import { ThemePanel } from "./theme-panel";
import { ResumeSelector, ResumeListItem } from "./resume-selector";
import { ConfirmDialog } from "./confirm-dialog";
import { RewritePanel, RewritePreviewState } from "./rewrite-panel";
import { Resume, ThemeVariables } from "@/lib/types";
import { EditorDrawer, editorDrawerClassName, toggleEditorDrawer } from "@/lib/editor-drawer";
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
  Trash2,
  MoreHorizontal,
  ImagePlus,
  AlertCircle,
  Target,
} from "lucide-react";
import Image from "next/image";

interface EditorProps {
  initialResume: Resume;
}

type SaveStatus = "saved" | "saving" | "unsaved" | "error";
type FocusMode = "split" | "edit" | "preview";
type SavePayload = Pick<Resume, "title" | "content" | "templateId" | "themeVariables" | "photo">;

function resolveThemeVariables(resume: Resume): ThemeVariables {
  return resume.themeVariables && Object.keys(resume.themeVariables).length > 0
    ? resume.themeVariables
    : getDefaultTheme(resume.templateId);
}

export function Editor({ initialResume }: EditorProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [currentResumeId, setCurrentResumeId] = useState(initialResume.id);
  const [title, setTitleState] = useState(initialResume.title);
  const [content, setContentState] = useState(initialResume.content);
  const [templateId, setTemplateIdState] = useState(initialResume.templateId);
  const [themeVariables, setThemeVariablesState] = useState<ThemeVariables>(
    resolveThemeVariables(initialResume)
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [isExporting, setIsExporting] = useState(false);
  const [drawer, setDrawer] = useState<EditorDrawer>(null);
  const drawerOpen = drawer === "design";
  const rewriteOpen = drawer === "rewrite";
  const [rewritePreview, setRewritePreview] = useState<RewritePreviewState | null>(null);
  const [focusMode, setFocusMode] = useState<FocusMode>("split");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [photo, setPhotoState] = useState<string | undefined>(initialResume.photo);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ResumeListItem | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const fileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);
  // 最近一次已持久化的快照，自动保存只提交与它的差异（避免每次全量重发照片等大字段）
  const lastSavedRef = useRef<SavePayload>({
    title: initialResume.title,
    content: initialResume.content,
    templateId: initialResume.templateId,
    themeVariables: resolveThemeVariables(initialResume),
    photo: initialResume.photo,
  });
  const currentResumeIdRef = useRef(initialResume.id);
  // 串行化保存请求，避免快速连续保存时旧响应覆盖新数据
  const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(false));

  const markUnsaved = useCallback(() => setSaveStatus("unsaved"), []);
  const setContent = useCallback((v: string) => { setContentState(v); markUnsaved(); }, [markUnsaved]);
  const setTitle = useCallback((v: string) => { setTitleState(v); markUnsaved(); }, [markUnsaved]);
  const setTemplateId = useCallback((v: string) => {
    setTemplateIdState(v);
    setThemeVariablesState(getDefaultTheme(v));
    markUnsaved();
  }, [markUnsaved]);
  const setThemeVariables = useCallback((v: ThemeVariables) => { setThemeVariablesState(v); markUnsaved(); }, [markUnsaved]);
  const setPhoto = useCallback((v: string | undefined) => { setPhotoState(v); markUnsaved(); }, [markUnsaved]);

  const saveResume = useCallback(
    async (data: Partial<SavePayload>): Promise<boolean> => {
      setSaveStatus("saving");
      const resumeId = currentResumeId;
      const run = saveChainRef.current.then(async () => {
        try {
          const res = await fetch(`/api/resumes/${resumeId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (!res.ok) throw new Error("Save failed");
          // 保存期间可能已切换简历，此时不要把旧简历的数据混入新快照
          if (currentResumeIdRef.current === resumeId) {
            lastSavedRef.current = { ...lastSavedRef.current, ...data };
            setSaveStatus("saved");
            if (data.title !== undefined) {
              setResumes((prev) =>
                prev.map((r) => (r.id === resumeId ? { ...r, title: data.title as string } : r))
              );
            }
          }
          return true;
        } catch (err) {
          console.error(err);
          if (currentResumeIdRef.current === resumeId) {
            setSaveStatus("error");
          }
          return false;
        }
      });
      saveChainRef.current = run;
      return run;
    },
    [currentResumeId]
  );

  const diffPayload = useCallback((): Partial<SavePayload> | null => {
    const saved = lastSavedRef.current;
    const diff: Partial<SavePayload> = {};
    if (title !== saved.title) diff.title = title;
    if (content !== saved.content) diff.content = content;
    if (templateId !== saved.templateId) diff.templateId = templateId;
    if (themeVariables !== saved.themeVariables) diff.themeVariables = themeVariables;
    if ((photo ?? "") !== (saved.photo ?? "")) diff.photo = photo ?? "";
    return Object.keys(diff).length > 0 ? diff : null;
  }, [title, content, templateId, themeVariables, photo]);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const diff = diffPayload();
      if (!diff) {
        // 内容与已保存快照一致（如输入后又撤销），无需请求
        setSaveStatus((s) => (s === "unsaved" ? "saved" : s));
        return;
      }
      saveResume(diff);
    }, 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, content, templateId, themeVariables, photo, diffPayload, saveResume]);

  // 未保存时提醒，避免关闭标签页丢数据
  useEffect(() => {
    if (saveStatus === "saved") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveStatus]);

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

  const applyResume = useCallback((resume: Resume) => {
    currentResumeIdRef.current = resume.id;
    setCurrentResumeId(resume.id);
    setTitleState(resume.title);
    setContentState(resume.content);
    setTemplateIdState(resume.templateId);
    const theme = resolveThemeVariables(resume);
    setThemeVariablesState(theme);
    setPhotoState(resume.photo);
    lastSavedRef.current = {
      title: resume.title,
      content: resume.content,
      templateId: resume.templateId,
      themeVariables: theme,
      photo: resume.photo,
    };
    setSaveStatus("saved");
  }, []);

  const loadResumes = useCallback(async () => {
    try {
      const res = await fetch("/api/resumes");
      if (!res.ok) throw new Error("Failed to load resumes");
      const data = await res.json();
      setResumes(data.resumes as ResumeListItem[]);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/resumes")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load resumes");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setResumes(data.resumes as ResumeListItem[]);
        }
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAndApplyResume = useCallback(
    async (resumeId: string) => {
      const res = await fetch(`/api/resumes/${resumeId}`);
      if (!res.ok) throw new Error("Failed to load resume");
      const data = await res.json();
      applyResume(data.resume as Resume);
      router.replace(`/?resumeId=${resumeId}`);
    },
    [applyResume, router]
  );

  const flushCurrentResume = useCallback(async () => {
    const diff = diffPayload();
    if (!diff) {
      setSaveStatus("saved");
      return true;
    }
    return saveResume(diff);
  }, [diffPayload, saveResume]);

  const handleSwitchResume = useCallback(
    async (resumeId: string) => {
      if (resumeId === currentResumeId) return;

      setIsSwitching(true);
      try {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        const saved = await flushCurrentResume();
        if (!saved) {
          alert("保存当前简历失败，请检查网络后重试");
          return;
        }

        await fetchAndApplyResume(resumeId);
      } catch (err) {
        console.error(err);
        alert("切换简历失败，请重试");
      } finally {
        setIsSwitching(false);
      }
    },
    [currentResumeId, flushCurrentResume, fetchAndApplyResume]
  );

  const handleCreateResume = useCallback(
    async (skipFlush?: boolean) => {
      setIsSwitching(true);
      try {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        if (!skipFlush) {
          const saved = await flushCurrentResume();
          if (!saved) {
            alert("保存当前简历失败，请检查网络后重试");
            return;
          }
        }

        const res = await fetch("/api/resumes", { method: "POST" });
        if (!res.ok) throw new Error("Create failed");
        const data = await res.json();
        const resume = data.resume as Resume;
        await loadResumes();
        applyResume(resume);
        router.replace(`/?resumeId=${resume.id}`);
      } catch (err) {
        console.error(err);
        alert("新建简历失败，请重试");
      } finally {
        setIsSwitching(false);
      }
    },
    [flushCurrentResume, loadResumes, applyResume, router]
  );

  const handleDuplicateResume = useCallback(async () => {
    setIsSwitching(true);
    try {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      const saved = await flushCurrentResume();
      if (!saved) {
        alert("保存当前简历失败，请检查网络后重试");
        return;
      }

      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceResumeId: currentResumeId }),
      });
      if (!res.ok) throw new Error("Duplicate failed");
      const data = await res.json();
      const resume = data.resume as Resume;
      await loadResumes();
      applyResume(resume);
      router.replace(`/?resumeId=${resume.id}`);
    } catch (err) {
      console.error(err);
      alert("复制简历失败，请重试");
    } finally {
      setIsSwitching(false);
    }
  }, [currentResumeId, flushCurrentResume, loadResumes, applyResume, router]);

  const handleDeleteResume = useCallback(
    async (resumeId: string) => {
      try {
        const res = await fetch(`/api/resumes/${resumeId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");

        const remaining = resumes.filter((r) => r.id !== resumeId);
        setResumes(remaining);

        if (resumeId === currentResumeId) {
          // 当前简历即将被删除/切换，取消挂起的自动保存，避免写入到已切换的上下文
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          setIsSwitching(true);
          try {
            if (remaining.length > 0) {
              await fetchAndApplyResume(remaining[0].id);
            } else {
              await handleCreateResume(true);
            }
          } catch (err) {
            console.error(err);
            alert("切换简历失败，请重试");
          } finally {
            setIsSwitching(false);
          }
        }
      } catch (err) {
        console.error(err);
        alert("删除简历失败，请重试");
      }
    },
    [resumes, currentResumeId, fetchAndApplyResume, handleCreateResume]
  );

  const showEditor = focusMode === "split" || focusMode === "edit";
  const showPreview = focusMode === "split" || focusMode === "preview";
  const previewContent =
    rewriteOpen && rewritePreview?.ready && rewritePreview.draftContent
      ? rewritePreview.draftContent
      : content;

  // Narrow screens use a single workspace pane. Split mode remains available
  // when the viewport grows again, but never forces two unusably small columns.
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const syncMode = () => {
      if (media.matches) {
        setFocusMode((mode) => (mode === "split" ? "edit" : mode));
      }
    };
    syncMode();
    media.addEventListener("change", syncMode);
    return () => media.removeEventListener("change", syncMode);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : drawerTriggerRef.current;
    const drawer = drawerRef.current;
    requestAnimationFrame(() => drawerCloseRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawer(null);
        return;
      }
      if (event.key !== "Tab" || !drawer) return;

      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute("inert"));
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
      previousFocus?.focus();
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!fileMenuOpen && !userMenuOpen) return;

    const closeMenus = (event: PointerEvent) => {
      const target = event.target as Node;
      if (fileMenuOpen && !fileMenuRef.current?.contains(target)) setFileMenuOpen(false);
      if (userMenuOpen && !userMenuRef.current?.contains(target)) setUserMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (fileMenuOpen) {
        setFileMenuOpen(false);
        fileMenuButtonRef.current?.focus();
      }
      if (userMenuOpen) {
        setUserMenuOpen(false);
        userMenuButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", closeMenus);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [fileMenuOpen, userMenuOpen]);

  // Keyboard shortcut: Cmd/Ctrl + S to force save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        const diff = diffPayload();
        if (diff) {
          saveResume(diff);
        } else {
          setSaveStatus((s) => (s === "unsaved" ? "saved" : s));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [diffPayload, saveResume]);

  const saveIndicator = useMemo(() => {
    switch (saveStatus) {
      case "saved":
        return { color: "bg-emerald-500", label: "已保存", tone: "text-emerald-700 dark:text-emerald-300" };
      case "saving":
        return { color: "bg-amber-400 animate-pulse", label: "保存中", tone: "text-amber-700 dark:text-amber-300" };
      case "unsaved":
        return { color: "bg-zinc-400", label: "待保存", tone: "text-zinc-600 dark:text-zinc-300" };
      case "error":
        return { color: "bg-red-500", label: "保存失败", tone: "text-red-700 dark:text-red-300" };
    }
  }, [saveStatus]);

  return (
    <div className="flex h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="relative z-50 flex flex-shrink-0 flex-wrap items-center gap-x-3 border-b border-zinc-200 bg-white/90 px-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90 sm:px-4">
        <div className="order-1 flex min-w-0 flex-1 items-center gap-2 py-2">
          <span className="select-none text-base font-semibold tracking-tight">Resumer</span>
          <div role="status" aria-live="polite" className="flex-shrink-0">
            {saveStatus === "error" ? (
              <button
                type="button"
                onClick={() => {
                  const diff = diffPayload();
                  if (diff) saveResume(diff);
                }}
                title="点击重试保存"
                className={`flex min-h-7 items-center gap-1 rounded-full bg-red-50 px-2 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-red-950/50 ${saveIndicator.tone}`}
              >
                <AlertCircle className="h-3 w-3" />
                {saveIndicator.label}
              </button>
            ) : (
              <span className={`flex min-h-7 items-center gap-1.5 rounded-full bg-zinc-100 px-2 text-[11px] font-medium dark:bg-zinc-800 ${saveIndicator.tone}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${saveIndicator.color}`} aria-hidden />
                {saveIndicator.label}
              </span>
            )}
          </div>
          <label className="min-w-0 flex-1 sm:flex-none">
            <span className="sr-only">简历标题</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="未命名简历"
              className="min-h-8 w-full min-w-0 max-w-[18ch] truncate rounded-md border-0 bg-transparent px-2 text-sm text-zinc-700 outline-none placeholder:text-zinc-400 hover:bg-zinc-100/70 focus-visible:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-500 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800"
            />
          </label>
          <ResumeSelector
            compact
            resumes={resumes}
            currentId={currentResumeId}
            disabled={isSwitching}
            onSelect={handleSwitchResume}
            onCreate={handleCreateResume}
            onDuplicate={handleDuplicateResume}
            onDelete={(id) => setDeleteTarget(resumes.find((r) => r.id === id) || null)}
          />

        {session?.user ? (
          <div ref={userMenuRef} className="relative flex-shrink-0">
            <button
              ref={userMenuButtonRef}
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-label="账户菜单"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:hover:bg-zinc-800"
              title={session.user.name || "账户菜单"}
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
              <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                  <div className="truncate text-sm font-medium">{session.user.name}</div>
                  {session.user.email && (
                    <div className="truncate text-xs text-zinc-500">{session.user.email}</div>
                  )}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    signOut();
                  }}
                  className="flex min-h-9 w-full items-center gap-2 px-3 text-left text-sm hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 dark:hover:bg-zinc-800"
                >
                  <LogOut className="h-3.5 w-3.5" /> 退出登录
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => signIn("github")}
            className="min-h-8 rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            登录
          </button>
        )}
        </div>

        <div className="order-3 flex w-full items-center justify-end gap-1.5 border-t border-zinc-200 py-2 dark:border-zinc-800 lg:order-2 lg:w-auto lg:border-0">
          <FocusToggle value={focusMode} onChange={setFocusMode} />

        <button
          ref={drawerTriggerRef}
          type="button"
          onClick={() => setDrawer((current) => toggleEditorDrawer(current, "design"))}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          aria-controls="design-drawer"
          className={[
            "flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500",
            drawerOpen
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
          ].join(" ")}
        >
          <Palette className="h-4 w-4" />
          设计
        </button>

        <button
          type="button"
          onClick={() => setDrawer((current) => toggleEditorDrawer(current, "rewrite"))}
          aria-haspopup="dialog"
          aria-expanded={rewriteOpen}
          aria-controls="rewrite-drawer"
          className={[
            "flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500",
            rewriteOpen
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
          ].join(" ")}
        >
          <Target className="h-4 w-4" />
          改写
        </button>

          <input
            ref={fileInputRef}
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
          <div ref={fileMenuRef} className="relative">
            <IconButton
              buttonRef={fileMenuButtonRef}
              title="更多操作"
              ariaExpanded={fileMenuOpen}
              onClick={() => setFileMenuOpen((v) => !v)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </IconButton>
            {fileMenuOpen && (
              <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-[190px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                <MenuButton
                  icon={<FileUp className="h-4 w-4" />}
                  label="导入 Markdown"
                  onClick={() => {
                    setFileMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                />
                <MenuButton
                  icon={<FileDown className="h-4 w-4" />}
                  label="导出 Markdown"
                  onClick={() => {
                    setFileMenuOpen(false);
                    handleExportMarkdown();
                  }}
                />
                <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
                <MenuButton
                  icon={<ImagePlus className="h-4 w-4" />}
                  label={photo ? "更换照片" : "上传照片"}
                  onClick={() => {
                    setFileMenuOpen(false);
                    photoInputRef.current?.click();
                  }}
                />
                {photo && (
                  <MenuButton
                    icon={<Trash2 className="h-4 w-4" />}
                    label="删除照片"
                    danger
                    onClick={() => {
                      setFileMenuOpen(false);
                      clearPhoto();
                    }}
                  />
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExporting}
            className="flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md bg-zinc-900 px-3 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:ring-offset-zinc-900"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            导出 PDF
          </button>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        {showEditor && (
          <div
            className={[
              "min-w-0 flex-col border-r border-zinc-200 dark:border-zinc-800",
              showPreview ? "w-1/2 md:flex" : "flex w-full",
              showPreview && focusMode === "split" ? "flex max-md:w-full" : "",
            ].join(" ")}
          >
            <label htmlFor="resume-markdown" className="sr-only">Markdown 简历内容</label>
            <textarea
              id="resume-markdown"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              className="flex-1 resize-none bg-white px-4 py-4 font-mono text-[13.5px] leading-[1.65] text-zinc-800 outline-none placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 dark:bg-zinc-950 dark:text-zinc-200 sm:px-6 sm:py-5"
              placeholder={"---\nname: 你的名字\n---\n\n## 工作经历\n..."}
            />
          </div>
        )}

        {showPreview && (
          <div className={`relative min-w-0 flex-col ${showEditor ? "w-1/2 md:flex" : "flex w-full"} ${showEditor && focusMode === "split" ? "max-md:hidden" : ""}`}>
            {rewriteOpen && rewritePreview?.ready ? (
              <div
                role="status"
                className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] font-medium tracking-wide text-white"
              >
                <span>建议稿 · 尚未另存</span>
                <span className="font-normal text-zinc-400">左侧是底稿</span>
              </div>
            ) : null}
            <div className="relative flex-1 overflow-auto bg-zinc-200/60 px-3 py-4 dark:bg-zinc-900 sm:px-6 sm:py-8">
              {rewriteOpen && rewritePreview?.generating ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/30">
                  <p className="rounded-full bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100">
                    正在改写…
                  </p>
                </div>
              ) : null}
              <Preview
                content={previewContent}
                templateId={templateId}
                themeVariables={themeVariables}
                photo={photo}
                scale={showEditor ? 0.82 : 1}
              />
            </div>
          </div>
        )}

        {(drawerOpen || rewriteOpen) && (
          <button
            type="button"
            aria-label={rewriteOpen ? "关闭改写面板" : "关闭设计面板"}
            onClick={() => setDrawer(null)}
            className="absolute inset-0 z-10 cursor-default bg-zinc-950/15 backdrop-blur-[1px]"
          />
        )}

        {/* Design drawer */}
        <aside
          ref={drawerRef}
          id="design-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="design-panel-title"
          className={editorDrawerClassName(drawerOpen, "sm:w-[360px]")}
          inert={!drawerOpen}
        >
          <ThemePanel
            value={themeVariables}
            templateId={templateId}
            onTemplateChange={setTemplateId}
            onChange={setThemeVariables}
            onReset={resetTheme}
          />
          <button
            ref={drawerCloseRef}
            type="button"
            onClick={() => setDrawer(null)}
            className="absolute right-2 top-2.5 flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:hover:bg-zinc-800"
            aria-label="关闭设计面板"
          >
            <X className="h-4 w-4" />
          </button>
        </aside>

        <RewritePanel
          open={rewriteOpen}
          resumeId={currentResumeId}
          onClose={() => setDrawer(null)}
          onBeforeGenerate={flushCurrentResume}
          onPreviewState={setRewritePreview}
          onApplied={async (resume) => {
            await loadResumes();
            applyResume(resume);
            router.replace(`/?resumeId=${resume.id}`);
            setDrawer(null);
          }}
        />
      </main>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除简历"
        message={`确定要删除「${deleteTarget?.title?.trim() || "未命名简历"}」吗？此操作无法撤销。`}
        confirmLabel="删除"
        cancelLabel="取消"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteTarget) {
            handleDeleteResume(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
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
    <div role="group" aria-label="工作区视图" className="flex items-center gap-0.5 rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          title={o.title}
          className={[
            "h-8 w-8 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500",
            o.id === "split" ? "hidden md:flex" : "flex",
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
