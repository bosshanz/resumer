"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers3,
  LayoutList,
  Plus,
  Star,
  Trash2,
  UserRound,
  Sparkles,
  ChevronRight,
  X,
} from "lucide-react";
import { Preview } from "../preview";
import { RichText } from "./rich-text";
import {
  readBuilder,
  patchField,
  splitPieces,
  replacePiece,
  togglePiece,
  joinPieces,
  orderedPieces,
  makePiece,
  editHeading,
  editPieceBody,
  richTextSafe,
  type Piece,
} from "@/lib/resume-builder";
import type { ThemeVariables } from "@/lib/types";
import type { PageFit } from "@/lib/page-fit";

type Selection =
  | { kind: "basics" | "summary" | "skills" }
  | { kind: "section"; section: number; entry?: number };
interface Props {
  content: string;
  previewContent: string;
  templateId: string;
  themeVariables: ThemeVariables;
  photo?: string;
  onChange: (value: string) => void;
  onPageFit: (fit: PageFit | null) => void;
  pageFit: PageFit | null;
  onSource: () => void;
  onDesign: () => void;
  onInspect: () => void;
  suggestion: boolean;
  generating: boolean;
  panelOpen: boolean;
  panelView: "settings" | "preview";
}
function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const text =
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  return (
    <label className="studio-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={text}
          rows={5}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input value={text} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}
function Prose({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [source, setSource] = useState(!richTextSafe(value));
  return (
    <div className="studio-prose">
      <div className="studio-field-heading">
        <span>正文</span>
        <button
          type="button"
          onClick={() => setSource((v) => !v)}
          disabled={source && !richTextSafe(value)}
        >
          {source ? "原格式编辑" : "切换 Markdown"}
        </button>
      </div>
      {source ? (
        <>
          <p className="studio-hint">
            保留复杂格式，可直接修改这个区块的 Markdown。
          </p>
          <textarea
            aria-label="区块原格式正文"
            className="studio-source-block"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </>
      ) : (
        <RichText value={value.trim()} onChange={onChange} />
      )}
    </div>
  );
}
function Skills({
  value,
  onChange,
  onSource,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  onSource: () => void;
}) {
  const groups =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const valid = (v: unknown): boolean =>
    typeof v === "string" ||
    (Array.isArray(v) && v.every((x) => typeof x === "string"));
  if (
    value != null &&
    !(Array.isArray(value)
      ? valid(value)
      : groups && Object.values(groups).every(valid))
  )
    return (
      <p>
        此技能格式请在{" "}
        <button type="button" onClick={onSource}>
          Markdown 模式
        </button>
        编辑。
      </p>
    );
  if (!groups)
    return (
      <>
        <p className="studio-hint">每行一项技能，也可以一次粘贴多行。</p>
        <Field
          label="技能"
          multiline
          value={Array.isArray(value) ? value.join("\n") : ""}
          onChange={(v) => onChange(v.split("\n"))}
        />
        <button
          className="studio-text-button"
          type="button"
          onClick={() => onChange({ 专业技能: value ?? [] })}
        >
          <Plus size={14} />
          按类别整理
        </button>
      </>
    );
  return (
    <>
      {Object.entries(groups).map(([name, items], index) => (
        <div className="studio-skill-group" key={index}>
          <div className="studio-field-heading">
            <strong>{name}</strong>
            <button
              type="button"
              aria-label={`删除技能分类 ${name}`}
              onClick={() =>
                onChange(
                  Object.fromEntries(
                    Object.entries(groups).filter(([key]) => key !== name),
                  ),
                )
              }
            >
              <Trash2 size={14} />
            </button>
          </div>
          <Field
            label="类别名称"
            value={name}
            onChange={(next) => {
              if (next !== name && !(next in groups))
                onChange(
                  Object.fromEntries(
                    Object.entries(groups).map(([key, val]) => [
                      key === name ? next : key,
                      val,
                    ]),
                  ),
                );
            }}
          />
          <Field
            label={`${name} · 每行一项`}
            multiline
            value={Array.isArray(items) ? items.join("\n") : items}
            onChange={(v) => onChange({ ...groups, [name]: v.split("\n") })}
          />
        </div>
      ))}
      <button
        className="studio-text-button"
        type="button"
        onClick={() => {
          let name = "新分类";
          let i = 2;
          while (name in groups) name = `新分类 ${i++}`;
          onChange({ ...groups, [name]: [] });
        }}
      >
        <Plus size={14} />
        添加技能分类
      </button>
    </>
  );
}
function HeadingFields({
  piece,
  entry,
  onChange,
}: {
  piece: Piece;
  entry: boolean;
  onChange: (next: Piece) => void;
}) {
  const raw = piece.heading.replace(/^#{2,3}[ \t]?/, "");
  // Consume only the delimiter spaces; user-entered spaces belong to the field.
  const parts = raw.split(/ [|｜] /);
  const structured = entry && parts.length === 3 && !/[*_`\[\]<>]/.test(raw);
  if (!structured)
    return (
      <Field
        label={entry ? "经历标题" : "区块标题"}
        value={raw}
        onChange={(value) => onChange(editHeading(piece, value))}
      />
    );
  return (
    <>
      {["公司 / 项目 / 学校", "职位 / 角色 / 专业", "起止时间"].map(
        (label, i) => (
          <Field
            key={i}
            label={label}
            value={parts[i]}
            onChange={(value) =>
              onChange(
                editHeading(
                  piece,
                  parts
                    .map((part, j) =>
                      j === i ? value.replace(/[|｜]/g, "／") : part,
                    )
                    .join(" | "),
                ),
              )
            }
          />
        ),
      )}
    </>
  );
}
export function ResumeStudio({
  content,
  previewContent,
  templateId,
  themeVariables,
  photo,
  onChange,
  onPageFit,
  pageFit,
  onSource,
  onDesign,
  onInspect,
  suggestion,
  generating,
  panelOpen,
  panelView,
}: Props) {
  const model = useMemo(() => readBuilder(content), [content]);
  const [selection, setSelection] = useState<Selection>({ kind: "basics" });
  const [mobilePane, setMobilePane] = useState<"content" | "preview">(
    "content",
  );
  const [mobileOutlineOpen, setMobileOutlineOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [undo, setUndo] = useState<{ before: string; after: string } | null>(
    null,
  );
  const canvas = useRef<HTMLDivElement>(null);
  const outline = useRef<HTMLElement>(null);
  const outlineTrigger = useRef<HTMLButtonElement>(null);
  const outlineClose = useRef<HTMLButtonElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const outlineVisible = mobileOutlineOpen && !panelOpen && mobilePane === "content";
  useEffect(() => {
    if (!panelOpen) return;
    const frame = requestAnimationFrame(() => setMobileOutlineOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [panelOpen]);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 599px)");
    const onResize = () => {
      if (!narrow.matches) setMobileOutlineOpen(false);
    };
    narrow.addEventListener("change", onResize);
    return () => narrow.removeEventListener("change", onResize);
  }, []);
  useEffect(() => {
    if (!outlineVisible) return;
    outlineClose.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOutlineOpen(false);
        requestAnimationFrame(() => outlineTrigger.current?.focus());
      }
      if (event.key !== "Tab" || !outline.current) return;
      const controls = [...outline.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href]',
      )].filter((control) => control.getClientRects().length > 0);
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!outline.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [outlineVisible]);
  const closeOutline = (restoreFocus = true) => {
    setMobileOutlineOpen(false);
    if (restoreFocus) requestAnimationFrame(() => outlineTrigger.current?.focus());
  };
  useEffect(() => {
    if (!addMenuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setAddMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [addMenuOpen]);
  const section =
    selection.kind === "section"
      ? model.sections[selection.section]
      : undefined;
  const entries = section ? splitPieces(section.body, 3) : [];
  const selected =
    selection.kind === "section" && selection.entry !== undefined
      ? entries[selection.entry]
      : section;
  const selectedKey =
    selection.kind === "section"
      ? `s${selection.section}${selection.entry === undefined ? "" : `e${selection.entry}`}`
      : selection.kind;
  const title =
    selection.kind === "basics"
      ? "基本信息"
      : selection.kind === "summary"
        ? "个人简介"
        : selection.kind === "skills"
          ? "专业技能"
          : (selected?.title ?? "选择区块");
  const choose = (next: Selection) => {
    if (panelOpen) onInspect();
    setSelection(next);
    setMobilePane("content");
    if (outlineVisible) closeOutline();
  };
  const commit = (next: string, structural = false) => {
    if (next === content) return;
    if (structural) setUndo({ before: content, after: next });
    onChange(next);
  };
  const field = (path: string[], value: unknown) =>
    commit(patchField(content, path, value));
  const setSections = (values: Piece[], structural = false) =>
    commit(
      model.front + (structural ? orderedPieces(values) : joinPieces(values)),
      structural,
    );
  const updateSelected = (next: Piece) => {
    if (selection.kind !== "section" || !section) return;
    const sections = [...model.sections];
    if (selection.entry === undefined) sections[selection.section] = next;
    else {
      const changedEntries = entries.map((entry, index) =>
        index === selection.entry ? next : entry,
      );
      sections[selection.section] = replacePiece(
        section,
        section.heading + joinPieces(changedEntries),
      );
    }
    setSections(sections);
  };
  const alter = (action: "up" | "down" | "hide" | "delete") => {
    if (selection.kind !== "section" || !selected || !section) return;
    const nested = selection.entry !== undefined;
    const list = nested ? [...entries] : [...model.sections];
    const index = nested ? selection.entry! : selection.section;
    if (action === "hide") list[index] = togglePiece(list[index]);
    if (action === "delete") list.splice(index, 1);
    if (action === "up" || action === "down") {
      const to = index + (action === "up" ? -1 : 1);
      if (to < 0 || to >= list.length || !list[to].heading) return;
      [list[index], list[to]] = [list[to], list[index]];
      setSelection(
        nested ? { ...selection, entry: to } : { kind: "section", section: to },
      );
    }
    if (action === "delete")
      setSelection(
        nested
          ? { kind: "section", section: selection.section }
          : { kind: "basics" },
      );
    if (nested) {
      const sections = [...model.sections];
      sections[selection.section] = replacePiece(
        section,
        section.heading + orderedPieces(list),
      );
      setSections(sections, true);
    } else setSections(list, true);
  };
  const addSection = (name: string) => {
    const index = model.sections.length;
    setSections([...model.sections, makePiece(name, 2)], true);
    choose({ kind: "section", section: index });
  };
  // Resolve only unique visible headings. Ambiguous legacy titles stay selectable
  // from the outline instead of opening the wrong record on the canvas.
  useEffect(() => {
    const root = canvas.current;
    if (!root) return;
    root.querySelectorAll("[data-studio-select]").forEach((el) => {
      el.removeAttribute("data-studio-select");
      el.removeAttribute("data-studio-active");
    });
    if (suggestion) return;
    const normalize = (s: string) => s.replace(/[\s|｜·]/g, "").toLowerCase();
    const candidates: { title: string; key: string; level: number }[] = [];
    model.sections.forEach((s, i) => {
      if (s.hidden) return;
      if (s.heading)
        candidates.push({ title: s.title, key: `s${i}`, level: 2 });
      splitPieces(s.body, 3).forEach((e, j) => {
        if (e.heading && !e.hidden)
          candidates.push({ title: e.title, key: `s${i}e${j}`, level: 3 });
      });
    });
    for (const item of candidates) {
      if (
        candidates.filter(
          (c) =>
            normalize(c.title) === normalize(item.title) &&
            c.level === item.level,
        ).length !== 1
      )
        continue;
      const matches = [...root.querySelectorAll(`h${item.level}`)].filter(
        (el) => normalize(el.textContent ?? "") === normalize(item.title),
      );
      if (matches.length !== 1) continue;
      const target =
        item.level === 3
          ? (matches[0].closest(".resume-entry") ?? matches[0])
          : matches[0];
      target.setAttribute("data-studio-select", item.key);
      if (selectedKey === item.key)
        target.setAttribute("data-studio-active", "true");
    }
    root.querySelectorAll("h1").forEach((el) => {
      el.setAttribute("data-studio-select", "basics");
      if (selectedKey === "basics")
        el.setAttribute("data-studio-active", "true");
    });
  }, [model, selectedKey, templateId, suggestion]);
  const selectionBody = selected
    ? selection.kind === "section" &&
      selection.entry === undefined &&
      entries.some((e) => e.heading)
      ? entries
          .filter((e) => !e.heading)
          .map((e) => e.raw)
          .join("")
      : selected.body
    : "";
  const editBody = (body: string) => {
    if (!selected) return;
    const tail =
      selection.kind === "section" &&
      selection.entry === undefined &&
      entries.some((e) => e.heading)
        ? entries
            .filter((e) => e.heading)
            .map((e) => e.raw)
            .join("")
        : "";
    updateSelected(editPieceBody(selected, body, tail));
  };
  const contact =
    model.fields.contact && typeof model.fields.contact === "object"
      ? (model.fields.contact as Record<string, unknown>)
      : {};
  return (
    <div
      className="resume-studio"
      data-mobile-pane={mobilePane}
      data-panel-open={panelOpen}
      data-panel-view={panelView}
      data-outline-open={outlineVisible}
    >
      <div className="studio-mobile-switch" inert={outlineVisible}>
        <button
          type="button"
          aria-pressed={mobilePane === "content"}
          onClick={() => setMobilePane("content")}
        >
          编辑内容
        </button>
        <button
          type="button"
          aria-pressed={mobilePane === "preview"}
          onClick={() => setMobilePane("preview")}
        >
          成品预览
        </button>
      </div>
      {outlineVisible && (
        <button
          type="button"
          className="studio-outline-backdrop"
          aria-label="关闭简历目录"
          onClick={() => closeOutline()}
        />
      )}
      <nav
        ref={outline}
        id="studio-outline"
        className="studio-outline"
        aria-label="简历目录"
        role={outlineVisible ? "dialog" : undefined}
        aria-modal={outlineVisible ? "true" : undefined}
      >
        <div className="studio-panel-label">
          <Layers3 size={15} />
          <span>简历目录</span>
          <button
            ref={outlineClose}
            className="studio-outline-close"
            type="button"
            aria-label="关闭简历目录"
            onClick={() => closeOutline()}
          >
            <X size={18} />
          </button>
        </div>
        <div className="studio-outline-scroll">
          {(
            [
              ["basics", "基本信息", UserRound],
              ["summary", "个人简介", FileText],
              ["skills", "专业技能", Sparkles],
            ] as const
          ).map(([kind, label, Icon]) => (
            <button
              type="button"
              key={kind}
              className="studio-outline-item"
              aria-current={selection.kind === kind ? "true" : undefined}
              onClick={() => choose({ kind })}
            >
              <Icon size={15} />
              <span>{label}</span>
              <ChevronRight size={12} />
            </button>
          ))}
          <div className="studio-outline-divider">经历与作品</div>
          {model.sections.map((s, i) =>
            !s.raw.trim() ? null : (
              <div key={i} className={s.hidden ? "studio-muted" : ""}>
                <button
                  type="button"
                  className="studio-outline-item"
                  aria-current={selectedKey === `s${i}` ? "true" : undefined}
                  onClick={() => choose({ kind: "section", section: i })}
                >
                  <span className="studio-number">
                    {String(
                      model.sections.slice(0, i + 1).filter((p) => p.raw.trim())
                        .length,
                    ).padStart(2, "0")}
                  </span>
                  <span>{s.title}</span>
                  {s.hidden && <EyeOff size={12} />}
                </button>
                {splitPieces(s.body, 3).map(
                  (e, j) =>
                    e.heading && (
                      <button
                        type="button"
                        key={j}
                        className={`studio-outline-entry ${e.hidden ? "studio-muted" : ""}`}
                        aria-current={
                          selectedKey === `s${i}e${j}` ? "true" : undefined
                        }
                        onClick={() =>
                          choose({ kind: "section", section: i, entry: j })
                        }
                      >
                        <span className="studio-entry-dot" />
                        <span>{e.title.split("|")[0].trim()}</span>
                        {e.hidden && <EyeOff size={12} />}
                      </button>
                    ),
                )}
              </div>
            ),
          )}
          <div ref={addMenuRef} className="studio-add-menu-wrap">
            <button
              type="button"
              className="studio-add-trigger"
              aria-expanded={addMenuOpen}
              aria-haspopup="menu"
              onClick={() => setAddMenuOpen((v) => !v)}
            >
              <Plus size={14} />
              添加区块
            </button>
            {addMenuOpen && (
              <div className="studio-add-popover" role="menu">
                {([
                  ["工作经历", "公司、职位与时间段", Briefcase],
                  ["项目经历", "项目名称与成果描述", FolderOpen],
                  ["教育背景", "院校、专业与学历", GraduationCap],
                  ["荣誉与证书", "奖项、认证与发表", Star],
                  ["自定义区块", "自由命名的内容区", LayoutList],
                ] as const).map(([name, desc, Icon]) => (
                  <button
                    key={name}
                    type="button"
                    role="menuitem"
                    className="studio-add-item"
                    onClick={() => {
                      setAddMenuOpen(false);
                      addSection(name);
                    }}
                  >
                    <span className="studio-add-item-icon">
                      <Icon size={15} />
                    </span>
                    <span className="studio-add-item-text">
                      <span>{name}</span>
                      <span>{desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="studio-outline-footer">
          <span>让经历成为作品。</span>
          <button type="button" onClick={onSource}>
            Markdown 专业模式 <ChevronRight size={12} />
          </button>
        </div>
      </nav>
      <section className="studio-canvas" inert={outlineVisible}>
        <div className="studio-canvas-bar">
          <span>
            <span className="studio-live-dot" />
            {suggestion ? "建议稿 · 尚未另存" : "实时预览"}
            {pageFit && (
              <span
                className="studio-fit"
                data-warning={pageFit.status === "slight-overflow"}
                title="按当前主题字号与行高估算"
              >
                {pageFit.label}
              </span>
            )}
          </span>
          <button type="button" onClick={onDesign}>
            调整版式 <ChevronRight size={12} />
          </button>
        </div>
        <div
          className="studio-paper-scroll"
          ref={canvas}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest("a");
            if (anchor) e.preventDefault();
            const key = target
              .closest("[data-studio-select]")
              ?.getAttribute("data-studio-select");
            if (key === "basics") choose({ kind: "basics" });
            else {
              const match = /^s(\d+)(?:e(\d+))?$/.exec(key ?? "");
              if (match)
                choose({
                  kind: "section",
                  section: Number(match[1]),
                  ...(match[2] === undefined
                    ? {}
                    : { entry: Number(match[2]) }),
                });
            }
          }}
        >
          {generating && (
            <div className="studio-notice" role="status">
              正在生成建议稿…
            </div>
          )}
          <Preview
            content={previewContent}
            templateId={templateId}
            themeVariables={themeVariables}
            photo={photo}
            onPageFit={onPageFit}
          />
          <p className="studio-canvas-caption">
            A4 · 点击标题或经历，编辑对应内容
          </p>
        </div>
      </section>
      <aside className="studio-inspector" aria-label="区块编辑面板" inert={outlineVisible}>
        <div className="studio-current-section">
          <span>当前区块：{title.split(/[|｜]/)[0].trim()}</span>
          <button
            ref={outlineTrigger}
            type="button"
            aria-controls="studio-outline"
            aria-expanded={outlineVisible}
            onClick={() => setMobileOutlineOpen(true)}
          >
            打开目录 <ChevronRight size={15} />
          </button>
        </div>
        <div className="studio-panel-label">
          <span>内容编辑</span>
        </div>
        <div className="studio-inspector-scroll">
          <div className="studio-inspector-title">
            <h2>{title.split(/[|｜]/)[0].trim()}</h2>
            <p>
              {selection.kind === "section"
                ? "写清职责，用成果体现价值。"
                : "用清晰的信息，建立第一印象。"}
            </p>
          </div>
          {undo && undo.after === content && (
            <div className="studio-notice" role="status">
              区块已更新
              <button
                type="button"
                onClick={() => {
                  onChange(undo.before);
                  setUndo(null);
                  setSelection({ kind: "basics" });
                }}
              >
                撤销操作
              </button>
            </div>
          )}
          {model.error && selection.kind !== "section" ? (
            <div className="studio-notice">
              {model.error}
              <button type="button" onClick={onSource}>
                打开 Markdown
              </button>
            </div>
          ) : (
            <>
              {selection.kind === "basics" && (
                <>
                  <div className="studio-field-grid">
                    <Field
                      label="姓名"
                      value={model.fields.name}
                      onChange={(v) => field(["name"], v)}
                    />
                    <Field
                      label="职业 / 目标职位"
                      value={model.fields.title}
                      onChange={(v) => field(["title"], v)}
                    />
                  </div>
                  <div className="studio-form-divider">联系方式</div>
                  {(
                    [
                      ["email", "邮箱"],
                      ["phone", "电话"],
                      ["location", "所在城市"],
                      ["website", "个人网站"],
                      ["github", "GitHub"],
                      ["linkedin", "LinkedIn"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field
                      key={key}
                      label={label}
                      value={contact[key]}
                      onChange={(v) => field(["contact", key], v)}
                    />
                  ))}
                  {model.fields.basics &&
                  typeof model.fields.basics === "object" ? (
                    <>
                      <div className="studio-form-divider">补充信息</div>
                      {Object.entries(model.fields.basics).map(([key, val]) => (
                        <Field
                          key={key}
                          label={key}
                          value={val}
                          onChange={(v) => field(["basics", key], v)}
                        />
                      ))}
                    </>
                  ) : null}
                </>
              )}
              {selection.kind === "summary" && (
                <>
                  <p className="studio-hint">
                    建议 2–4 句话，突出方向、经验和核心优势。
                  </p>
                  <Field
                    label="个人简介"
                    multiline
                    value={model.fields.summary}
                    onChange={(v) => field(["summary"], v)}
                  />
                </>
              )}
              {selection.kind === "skills" && (
                <Skills
                  value={model.fields.skills}
                  onChange={(v) => field(["skills"], v)}
                  onSource={onSource}
                />
              )}
              {selection.kind === "section" && selected && (
                <>
                  {selected.hidden && (
                    <div className="studio-notice">
                      已隐藏，预览和 PDF 不显示此内容。
                    </div>
                  )}
                  {selected.heading && (
                    <>
                      <div className="studio-block-actions">
                        <button
                          type="button"
                          aria-label="上移区块"
                          disabled={
                            (selection.entry ?? selection.section) === 0 ||
                            !(
                              selection.entry === undefined
                                ? model.sections
                                : entries
                            )[(selection.entry ?? selection.section) - 1]
                              ?.heading
                          }
                          onClick={() => alter("up")}
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label="下移区块"
                          disabled={
                            (selection.entry ?? selection.section) >=
                            (selection.entry === undefined
                              ? model.sections
                              : entries
                            ).length -
                              1
                          }
                          onClick={() => alter("down")}
                        >
                          <ArrowDown size={15} />
                        </button>
                        <button type="button" onClick={() => alter("hide")}>
                          {selected.hidden ? (
                            <Eye size={15} />
                          ) : (
                            <EyeOff size={15} />
                          )}
                          {selected.hidden ? "显示" : "隐藏"}
                        </button>
                        <button
                          type="button"
                          aria-label="删除区块"
                          onClick={() => alter("delete")}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <HeadingFields
                        piece={selected}
                        entry={selection.entry !== undefined}
                        onChange={updateSelected}
                      />
                    </>
                  )}
                  <Prose
                    key={selectedKey}
                    value={
                      selected.heading
                        ? selectionBody.replace(/^\r?\n\r?\n/, "")
                        : selectionBody
                    }
                    onChange={editBody}
                  />
                  {selection.entry === undefined && (
                    <button
                      type="button"
                      className="studio-add-entry"
                      onClick={() => {
                        const next = [
                          ...entries,
                          makePiece("新经历 | 职位 | 时间", 3),
                        ];
                        const sections = [...model.sections];
                        sections[selection.section] = replacePiece(
                          section!,
                          section!.heading + "\n\n" + orderedPieces(next),
                        );
                        setSections(sections, true);
                        choose({ ...selection, entry: next.length - 1 });
                      }}
                    >
                      <Plus size={15} />
                      添加一段经历
                    </button>
                  )}
                </>
              )}
              {selection.kind === "section" && !selected && (
                <button
                  type="button"
                  onClick={() => choose({ kind: "basics" })}
                >
                  内容已变更，返回基本信息
                </button>
              )}
            </>
          )}
        </div>
        <div className="studio-inspector-footer">
          修改会自动保存 · ⌘ / Ctrl + S 手动保存
        </div>
      </aside>
    </div>
  );
}
