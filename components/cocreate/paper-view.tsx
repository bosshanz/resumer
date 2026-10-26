"use client";

import { KeyboardEvent, MouseEvent, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Lightbulb, Pencil, Scissors, Sparkles, X } from "lucide-react";
import { Preview } from "@/components/preview";
import { commitLineEdit, fillPending, locateLine, parseDoc } from "@/lib/cocreate/doc";
import { applyEdit, normalizeLine, readFieldValue } from "@/lib/cocreate/edits";
import {
  findPendingLine,
  indexTargets,
  locateContext,
  remarkPendingMarks,
  resolveTarget,
  splitPending,
  type PaperTarget,
} from "@/lib/cocreate/paper";
import type { EditableField, ResumeEditing } from "@/lib/templates/editing";
import type { PageFit } from "@/lib/page-fit";
import type { ThemeVariables } from "@/lib/types";
import { ActionTarget, SelectionAction, SELECTION_ACTION_LABELS } from "@/lib/cocreate/types";

const ACTION_ICONS = { tighten: Scissors, star: Sparkles, hint: Lightbulb } as const;
const ACTIONS: SelectionAction[] = ["tighten", "star", "hint"];
const FIELD_LABELS: Record<EditableField, string> = { name: "姓名", title: "求职方向", summary: "个人简介" };
const PENDING_PLUGINS = [remarkPendingMarks];

interface PaperViewProps {
  content: string;
  onChange: (next: string) => void;
  onAction: (action: SelectionAction, target: ActionTarget) => void;
  busy: boolean;
  aiReady: boolean;
  /** 刚被 AI 写入的行（规范化后），短暂高亮 */
  flashLines: Set<string>;
  templateId: string;
  themeVariables: ThemeVariables;
  photo?: string;
  onPageFit?: (fit: PageFit | null) => void;
}

type Active =
  | { type: "line"; line: number; original: string; target: PaperTarget; mode: "actions" | "edit" }
  | { type: "field"; field: EditableField }
  | { type: "pending"; placeholder: string; label: string; line: number | null; field: EditableField | null; index: number };

function isComposing(event: KeyboardEvent) {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

function readField(content: string, key: EditableField): string {
  const result = readFieldValue(content, [key]);
  if (!result.ok || result.value == null) return "";
  return typeof result.value === "string" ? result.value : String(result.value);
}

/** 单行就地编辑：Enter 保存，Esc 取消；简介允许 Shift+Enter 换行 */
function LineEditor({
  initial,
  multiline,
  removable,
  onSave,
  onCancel,
  label,
}: {
  initial: string;
  multiline?: boolean;
  removable?: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
  label: string;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);
  return (
    <div className="cc-line-editor">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        aria-label={label}
        onChange={(event) => setValue(multiline ? event.target.value : event.target.value.replace(/\n/g, " "))}
        onKeyDown={(event) => {
          if (isComposing(event)) return;
          if (event.key === "Enter" && !(multiline && event.shiftKey)) {
            event.preventDefault();
            onSave(value);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
      />
      <div className="cc-line-editor-actions">
        <span>Enter 保存 · Esc 取消{removable ? " · 清空即删除" : ""}</span>
        <button type="button" onClick={onCancel}>取消</button>
        <button type="button" className="is-primary" onClick={() => onSave(value)}>保存</button>
      </div>
    </div>
  );
}

function PendingFill({ label, onFill, onCancel }: { label: string; onFill: (value: string) => string | null; onCancel: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  const commit = () => setError(onFill(value));
  return (
    <div className="cc-fill">
      <input
        ref={ref}
        value={value}
        aria-label={`补充：${label}`}
        placeholder={label}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (isComposing(event)) return;
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
      />
      <button type="button" aria-label="填入" onClick={commit}>
        <Check className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="取消" onClick={onCancel}>
        <X className="h-3.5 w-3.5" />
      </button>
      {error && <span className="cc-fill-error" role="alert">{error}</span>}
    </div>
  );
}

function pendingLabel(placeholder: string): string {
  const part = splitPending(placeholder)[0];
  return part?.kind === "pending" ? part.label : "待补充";
}

/** 稿面上「待补」标记的 React 版本（基本信息字段用；正文由 remark 插件生成同样的结构） */
function renderFieldText(field: EditableField, value: string | undefined): ReactNode {
  if (!value || !value.trim()) {
    return <span data-cc-placeholder="">{FIELD_LABELS[field]}</span>;
  }
  const parts = splitPending(value);
  if (parts.length === 1 && parts[0].kind === "text") return value;
  return parts.map((part, index) =>
    part.kind === "text" ? (
      part.text
    ) : (
      <span key={index} data-cc-pending={part.placeholder} role="button" tabIndex={0} title="点击填写">
        待补 · {part.label}
      </span>
    )
  );
}

/**
 * AI 共创的主题稿面：直接用当前模板（与「设计」面板、预览、PDF 同一个组件和样式）渲染，
 * 只在渲染出的块上挂编辑入口。点一条弹出操作，编辑、填写待补都在纸外的浮层里完成，
 * 不改变纸面排版，所见即导出结果。
 */
export function PaperView({ content, onChange, onAction, busy, aiReady, flashLines, templateId, themeVariables, photo, onPageFit }: PaperViewProps) {
  const model = useMemo(() => parseDoc(content), [content]);
  const targets = useMemo(() => indexTargets(model), [model]);
  const [active, setActive] = useState<Active | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // 内容变化后，按原文重新找回正在操作的那一行
  const activeLine = active?.type === "line" ? locateLine(model.lines, active.line, active.original) : null;
  const lost = active?.type === "line" && activeLine === -1;
  const selectedLine = active?.type === "line" && activeLine !== null && activeLine >= 0 ? activeLine : null;

  const editing = useMemo<ResumeEditing>(() => {
    const cache = new Map<string, number>();
    const stateOf = (line: number) => {
      if (line === selectedLine) return "selected";
      return flashLines.has(normalizeLine(model.lines[line] ?? "")) ? "flash" : undefined;
    };
    return {
      remarkPlugins: PENDING_PLUGINS,
      blockProps(kind, source, startLine, endLine) {
        const target = resolveTarget(model, targets, kind, source, startLine, endLine, cache);
        if (!target) return undefined;
        return {
          "data-cc-line": target.line,
          "data-cc-kind": target.kind,
          "data-cc-state": stateOf(target.line),
          // 经历标题里的「待补」不拆成标记（保持标题排版），整行标出来
          "data-cc-pending-row": target.kind === "entry" && splitPending(target.text).some((part) => part.kind === "pending") ? "" : undefined,
          tabIndex: 0,
          "aria-label": target.kind === "entry" ? `编辑经历标题：${target.text}` : `选中：${target.text}`,
        };
      },
      fieldProps(field) {
        return {
          "data-cc-field": field,
          "data-cc-state": active?.type === "field" && active.field === field ? "selected" : undefined,
          tabIndex: 0,
          "aria-label": `编辑${FIELD_LABELS[field]}`,
        };
      },
      fieldText: renderFieldText,
    };
  }, [model, targets, selectedLine, flashLines, active]);

  const anchorOf = useCallback(
    (state: Active | null): HTMLElement | null => {
      const frame = frameRef.current;
      if (!frame || !state) return null;
      if (state.type === "line") {
        return selectedLine === null ? null : frame.querySelector<HTMLElement>(`[data-cc-line="${selectedLine}"]`);
      }
      if (state.type === "field") return frame.querySelector<HTMLElement>(`[data-cc-field="${state.field}"]`);
      const chips = Array.from(frame.querySelectorAll<HTMLElement>("[data-cc-pending]"));
      return chips[state.index]?.dataset.ccPending === state.placeholder ? chips[state.index] : chips.find((chip) => chip.dataset.ccPending === state.placeholder) ?? null;
    },
    [selectedLine]
  );

  const close = useCallback(
    (refocus = true) => {
      const anchor = anchorOf(active);
      setActive(null);
      setNotice(null);
      if (refocus) anchor?.focus({ preventScroll: true });
    },
    [active, anchorOf]
  );

  // 浮层定位：挂在纸的下方，横向夹在可视区域内；纸会被缩放，所以按实际矩形算
  useLayoutEffect(() => {
    if (!active) return;
    const place = () => {
      const frame = frameRef.current;
      const pop = popRef.current;
      const anchor = anchorOf(active);
      if (!frame || !pop || !anchor) return;
      const frameRect = frame.getBoundingClientRect();
      const rect = anchor.getBoundingClientRect();
      const width = pop.offsetWidth;
      const maxLeft = Math.max(8, frame.clientWidth - width - 8);
      setPos({
        top: rect.bottom - frameRect.top + 6,
        left: Math.min(maxLeft, Math.max(8, rect.left - frameRect.left - 8)),
      });
    };
    place();
    // 首次出现时，若浮层落在滚动区外，就近滚进来
    const reveal = requestAnimationFrame(() => popRef.current?.scrollIntoView?.({ block: "nearest" }));
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(place);
    observer.observe(frame);
    return () => {
      cancelAnimationFrame(reveal);
      observer.disconnect();
    };
  }, [active, anchorOf, content, themeVariables, templateId]);

  // 操作浮层在点外面时收起；编辑中的输入不因误点丢失
  useEffect(() => {
    if (!active) return;
    const onDown = (event: PointerEvent) => {
      const node = event.target as Node;
      if (popRef.current?.contains(node)) return;
      if ((node as Element).closest?.("[data-cc-line],[data-cc-field],[data-cc-pending]") && frameRef.current?.contains(node)) return;
      if (active.type === "line" && active.mode === "edit") return;
      if (active.type === "field") return;
      setActive(null);
      setNotice(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active]);

  // 键盘打开操作浮层时，焦点直接进到浮层里
  const actionsOpen = active?.type === "line" && active.mode === "actions";
  useEffect(() => {
    if (actionsOpen) popRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [actionsOpen, selectedLine]);

  const activate = (element: HTMLElement) => {
    const pending = element.closest<HTMLElement>("[data-cc-pending]");
    if (pending) {
      const placeholder = pending.dataset.ccPending || "";
      const fieldHost = pending.closest<HTMLElement>("[data-cc-field]");
      const lineHost = pending.closest<HTMLElement>("[data-cc-line]");
      const chips = Array.from(frameRef.current?.querySelectorAll<HTMLElement>("[data-cc-pending]") ?? []);
      setNotice(null);
      setActive({
        type: "pending",
        placeholder,
        label: pendingLabel(placeholder),
        line: lineHost ? Number(lineHost.dataset.ccLine) : null,
        field: (fieldHost?.dataset.ccField as EditableField | undefined) ?? null,
        index: chips.indexOf(pending),
      });
      return;
    }
    const field = element.closest<HTMLElement>("[data-cc-field]");
    if (field) {
      setNotice(null);
      setActive({ type: "field", field: field.dataset.ccField as EditableField });
      return;
    }
    const lineHost = element.closest<HTMLElement>("[data-cc-line]");
    if (!lineHost) return;
    const line = Number(lineHost.dataset.ccLine);
    const target = targets.get(line);
    if (!target) return;
    if (active?.type === "line" && active.mode === "actions" && selectedLine === line) {
      setActive(null);
      return;
    }
    setNotice(null);
    setActive({ type: "line", line, original: model.lines[line], target, mode: target.kind === "entry" ? "edit" : "actions" });
  };

  const onPaperClick = (event: MouseEvent<HTMLDivElement>) => {
    const element = event.target as HTMLElement;
    // 纸面上的链接（邮箱、主页）在共创里不跳转
    if (element.closest("a")) event.preventDefault();
    activate(element);
  };

  const onPaperKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const element = event.target as HTMLElement;
    if (!element.matches("[data-cc-line],[data-cc-field],[data-cc-pending]")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate(element);
    }
    if (event.key === "Escape" && active) {
      event.preventDefault();
      close();
    }
  };

  const saveLine = (value: string) => {
    if (active?.type !== "line") return;
    const text = value.trim();
    if (!text && !active.target.removable) {
      close();
      return;
    }
    const next = commitLineEdit(content, active.line, active.original, text ? `${active.target.prefix}${text}` : null);
    if (next === null) {
      setNotice("这一行刚被 AI 改过，已保留你的输入，请对照后再保存。");
      return;
    }
    onChange(next);
    close(!!text);
  };

  const saveField = (field: EditableField, value: string) => {
    const before = readField(content, field);
    const result = applyEdit(content, { kind: "field", path: [field], before, after: value.trim() });
    if (!result.ok) {
      setNotice("这一项刚被改过，请对照后再保存。");
      return;
    }
    onChange(result.content);
    close();
  };

  const fill = (state: Extract<Active, { type: "pending" }>, value: string): string | null => {
    const text = value.trim();
    if (!text) return "先写点内容";
    if (state.field) {
      const before = readField(content, state.field);
      if (!before.includes(state.placeholder)) return "这处待补已经被改动，请重新查看";
      const result = applyEdit(content, { kind: "field", path: [state.field], before, after: before.replace(state.placeholder, text) });
      if (!result.ok) return "这处待补已经被改动，请重新查看";
      onChange(result.content);
    } else {
      const line = findPendingLine(model.lines, state.placeholder, state.line, model.bodyStart);
      if (line < 0) return "这处待补已经被改动，请重新查看";
      const next = fillPending(content, { line, start: model.lines[line].indexOf(state.placeholder), placeholder: state.placeholder }, text);
      if (next === null) return "这处待补已经被改动，请重新查看";
      onChange(next);
    }
    setActive(null);
    return null;
  };

  let popover: ReactNode = null;
  if (active?.type === "line" && active.mode === "actions" && selectedLine !== null) {
    const target = active.target;
    popover = (
      <div className="cc-pop-actions" role="toolbar" aria-label="对这一条">
        <button type="button" onClick={() => setActive({ ...active, mode: "edit" })}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          编辑
        </button>
        {target.kind === "bullet" &&
          ACTIONS.map((action) => {
            const Icon = ACTION_ICONS[action];
            return (
              <button
                key={action}
                type="button"
                disabled={busy || !aiReady}
                title={!aiReady ? "还没配置模型" : busy ? "AI 正在回复，稍等一下" : undefined}
                onClick={() => {
                  setActive(null);
                  onAction(action, { ...locateContext(model, selectedLine), bullet: target.text });
                }}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {SELECTION_ACTION_LABELS[action]}
              </button>
            );
          })}
      </div>
    );
  } else if (active?.type === "line" && active.mode === "edit") {
    const label = active.target.kind === "entry" ? "编辑经历标题" : active.target.kind === "bullet" ? "编辑要点" : "编辑段落";
    popover = (
      <>
        <LineEditor key={`${active.line}:${active.original}`} label={label} initial={active.target.text} removable={active.target.removable} onCancel={() => close()} onSave={saveLine} />
        {(notice || lost) && (
          <p className="cc-row-notice" role="alert">
            {notice || "这一行刚被 AI 改过，已保留你的输入，请对照后再保存。"}
          </p>
        )}
      </>
    );
  } else if (active?.type === "field") {
    popover = (
      <>
        <LineEditor
          key={active.field}
          label={`编辑${FIELD_LABELS[active.field]}`}
          initial={readField(content, active.field)}
          multiline={active.field === "summary"}
          onCancel={() => close()}
          onSave={(value) => saveField(active.field, value)}
        />
        {notice && <p className="cc-row-notice" role="alert">{notice}</p>}
      </>
    );
  } else if (active?.type === "pending") {
    const state = active;
    popover = <PendingFill key={`${state.placeholder}:${state.index}`} label={state.label} onCancel={() => close()} onFill={(value) => fill(state, value)} />;
  }

  return (
    <div ref={frameRef} className="cc-paper" onClick={onPaperClick} onKeyDown={onPaperKeyDown}>
      <Preview content={content} templateId={templateId} themeVariables={themeVariables} photo={photo} onPageFit={onPageFit} editing={editing} />
      {popover && (
        <div
          ref={popRef}
          className="cc-pop"
          data-mode={active?.type === "line" ? active.mode : active?.type}
          style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, opacity: 0 }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
        >
          {popover}
        </div>
      )}
    </div>
  );
}
