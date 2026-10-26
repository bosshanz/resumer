"use client";

import { Fragment, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Check, Lightbulb, Pencil, Scissors, Sparkles, X } from "lucide-react";

const ACTION_ICONS = { tighten: Scissors, star: Sparkles, hint: Lightbulb } as const;
import { commitLineEdit, DocBlock, fillPending, parseDoc, PENDING_PATTERN } from "@/lib/cocreate/doc";
import { applyEdit, normalizeLine, readFieldValue } from "@/lib/cocreate/edits";
import { ActionTarget, SelectionAction, SELECTION_ACTION_LABELS } from "@/lib/cocreate/types";

interface DraftViewProps {
  content: string;
  onChange: (next: string) => void;
  onAction: (action: SelectionAction, target: ActionTarget) => void;
  busy: boolean;
  aiReady: boolean;
  /** 刚被 AI 写入的行（规范化后），短暂高亮 */
  flashLines: Set<string>;
}

type Notice = { line: number; text: string } | null;

function isComposing(event: KeyboardEvent) {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

/** 行内文本：把「待补：…」渲染成可点击填写的标记，**粗体** 保留强调 */
function InlineText({
  text,
  offset,
  line,
  content,
  onChange,
}: {
  text: string;
  offset: number;
  line: number;
  content: string;
  onChange: (next: string) => void;
}) {
  const [filling, setFilling] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const parts: Array<{ kind: "text"; text: string } | { kind: "pending"; label: string; start: number; placeholder: string }> = [];
  const pattern = new RegExp(PENDING_PATTERN.source, "g");
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) parts.push({ kind: "text", text: text.slice(last, match.index) });
    parts.push({ kind: "pending", label: match[1].trim() || "待补", start: offset + match.index, placeholder: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });

  const commit = (part: { start: number; placeholder: string }) => {
    const next = fillPending(content, { line, start: part.start, placeholder: part.placeholder }, value);
    if (next === null) {
      setError(value.trim() ? "这处待补已经被改动，请重新查看" : "先写点内容");
      return;
    }
    onChange(next);
    setFilling(null);
    setValue("");
    setError(null);
  };

  return (
    <>
      {parts.map((part, index) =>
        part.kind === "text" ? (
          <Fragment key={index}>{renderEmphasis(part.text)}</Fragment>
        ) : filling === part.start ? (
          <span key={index} className="cc-fill" onClick={(event) => event.stopPropagation()}>
            <input
              autoFocus
              value={value}
              aria-label={`补充：${part.label}`}
              placeholder={part.label}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (isComposing(event)) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit(part);
                }
                if (event.key === "Escape") {
                  setFilling(null);
                  setError(null);
                }
              }}
            />
            <button type="button" aria-label="填入" onClick={() => commit(part)}>
              <Check className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="取消" onClick={() => setFilling(null)}>
              <X className="h-3.5 w-3.5" />
            </button>
            {error && <span className="cc-fill-error" role="alert">{error}</span>}
          </span>
        ) : (
          <button
            key={index}
            type="button"
            className="cc-pending"
            data-pending
            title="点击直接填写"
            onClick={(event) => {
              event.stopPropagation();
              setFilling(part.start);
              setValue("");
              setError(null);
            }}
          >
            待补 · {part.label}
          </button>
        )
      )}
    </>
  );
}

function renderEmphasis(text: string) {
  const pieces = text.split(/(\*\*[^*]+\*\*)/g);
  return pieces.map((piece, index) =>
    /^\*\*[^*]+\*\*$/.test(piece) ? <strong key={index}>{piece.slice(2, -2)}</strong> : <Fragment key={index}>{piece}</Fragment>
  );
}

/** 单行就地编辑：Enter 保存，Shift+Enter 不换行（简历要点是一行），Esc 取消 */
function LineEditor({
  initial,
  multiline,
  onSave,
  onCancel,
  label,
}: {
  initial: string;
  multiline?: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
  label: string;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);
  return (
    <div className="cc-line-editor" onClick={(event) => event.stopPropagation()}>
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
            onCancel();
          }
        }}
      />
      <div className="cc-line-editor-actions">
        <span>Enter 保存 · Esc 取消{multiline ? "" : " · 清空即删除"}</span>
        <button type="button" onClick={onCancel}>取消</button>
        <button type="button" className="is-primary" onClick={() => onSave(value)}>保存</button>
      </div>
    </div>
  );
}

const ACTIONS: SelectionAction[] = ["tighten", "star", "hint"];

/** 可点击的区域。里面还有“待补”按钮，所以不能用 <button> 嵌套 */
function Clickable({
  className,
  label,
  onActivate,
  children,
}: {
  className: string;
  label: string;
  onActivate: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      className={className}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
        }
      }}
    >
      {children}
    </div>
  );
}

export function DraftView({ content, onChange, onAction, busy, aiReady, flashLines }: DraftViewProps) {
  const model = useMemo(() => parseDoc(content), [content]);
  const [editing, setEditing] = useState<number | "name" | "title" | "summary" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const field = (key: string) => {
    const result = readFieldValue(content, [key]);
    return result.ok && typeof result.value === "string" ? result.value : result.ok && result.value != null ? String(result.value) : "";
  };
  const contactResult = readFieldValue(content, ["contact"]);
  const contact =
    contactResult.ok && contactResult.value && typeof contactResult.value === "object"
      ? Object.values(contactResult.value as Record<string, unknown>).filter((value) => typeof value === "string" && value.trim()).join(" · ")
      : "";
  const name = field("name");
  const title = field("title");
  const summary = field("summary");
  const empty = !name && !title && !summary && model.sections.length === 0 && model.preface.length === 0;

  // 内容变化后，选中的行可能已不存在
  const [selectedRaw, setSelected] = useState<number | null>(null);
  const selected = selectedRaw !== null && model.lines[selectedRaw]?.trim() ? selectedRaw : null;

  const saveField = (key: "name" | "title" | "summary", value: string) => {
    const before = field(key);
    const result = applyEdit(content, { kind: "field", path: [key], before, after: value.trim() });
    if (result.ok) onChange(result.content);
    setEditing(null);
  };

  const saveLine = (line: number, prefix: string, original: string, value: string, removable: boolean) => {
    const text = value.trim();
    if (!text && !removable) {
      setEditing(null);
      return;
    }
    const next = commitLineEdit(content, line, original, text ? `${prefix}${text}` : null);
    if (next === null) {
      setNotice({ line, text: "这一行刚被 AI 改过，已保留你的输入，请对照后再保存。" });
      return;
    }
    onChange(next);
    setEditing(null);
    setNotice(null);
    setSelected(null);
  };

  const flash = (line: number) => (flashLines.has(normalizeLine(model.lines[line] ?? "")) ? " cc-flash" : "");

  const renderBlock = (block: DocBlock, target: { section: string; entry?: string }) => {
    if (block.type === "hidden") {
      return (
        <p key={block.line} className="cc-hidden-note">
          有一项内容已隐藏，可在可视化模式中恢复
        </p>
      );
    }
    const raw = model.lines[block.line];
    const prefix = block.type === "bullet" ? block.prefix : raw.slice(0, raw.length - raw.trimStart().length);
    const text = block.type === "bullet" ? block.text : raw.trim();
    const isBullet = block.type === "bullet";
    const isSelected = selected === block.line;

    if (editing === block.line) {
      return (
        <div key={block.line} className={isBullet ? "cc-bullet is-editing" : "cc-text is-editing"}>
          <LineEditor
            label={isBullet ? "编辑要点" : "编辑段落"}
            initial={text}
            onCancel={() => {
              setEditing(null);
              setNotice(null);
            }}
            onSave={(value) => saveLine(block.line, prefix, raw, value, true)}
          />
          {notice?.line === block.line && <p className="cc-row-notice" role="alert">{notice.text}</p>}
        </div>
      );
    }

    return (
      <div
        key={block.line}
        className={`${isBullet ? "cc-bullet" : "cc-text"}${isSelected ? " is-selected" : ""}${flash(block.line)}`}
      >
        <div
          role="button"
          tabIndex={0}
          aria-pressed={isSelected}
          aria-label={isBullet ? `选中要点：${text}` : `选中段落`}
          className="cc-row"
          onClick={() => setSelected(isSelected ? null : block.line)}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setSelected(isSelected ? null : block.line);
            }
            if (event.key === "Escape") setSelected(null);
          }}
        >
          {isBullet && <span className="cc-dot" aria-hidden />}
          <span className="cc-row-text">
            <InlineText text={text} offset={raw.indexOf(text)} line={block.line} content={content} onChange={onChange} />
          </span>
        </div>
        {isSelected && (
          <div className="cc-row-actions" role="toolbar" aria-label="对这一条">
            <button type="button" onClick={() => setEditing(block.line)}>
              <Pencil className="h-3.5 w-3.5" />
              编辑
            </button>
            {isBullet &&
              ACTIONS.map((action) => {
                const Icon = ACTION_ICONS[action];
                return (
                  <button
                    key={action}
                    type="button"
                    disabled={busy || !aiReady}
                    title={!aiReady ? "还没配置模型" : busy ? "AI 正在回复，稍等一下" : undefined}
                    onClick={() => {
                      setSelected(null);
                      onAction(action, { ...target, bullet: text });
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {SELECTION_ACTION_LABELS[action]}
                  </button>
                );
              })}
          </div>
        )}
      </div>
    );
  };

  const renderField = (key: "name" | "title" | "summary", value: string, placeholder: string, className: string) =>
    editing === key ? (
      <LineEditor
        label={`编辑${placeholder}`}
        initial={value}
        multiline={key === "summary"}
        onCancel={() => setEditing(null)}
        onSave={(next) => saveField(key, next)}
      />
    ) : (
      <Clickable className={`${className} cc-field${value ? "" : " is-empty"}`} label={`编辑${placeholder}`} onActivate={() => setEditing(key)}>
        {value ? <InlineText text={value} offset={-1} line={-1} content={content} onChange={onChange} /> : placeholder}
      </Clickable>
    );

  if (empty && editing === null) {
    return (
      <div className="cc-draft-empty">
        <p className="cc-draft-empty-title">简历还是空的</p>
        <p>在左边回答 AI 的问题，内容会一条条出现在这里。你也可以随时直接改。</p>
        <button type="button" onClick={() => setEditing("name")}>先填姓名</button>
      </div>
    );
  }

  return (
    <article className="cc-draft" aria-label="简历稿面">
      <header className="cc-profile">
        {renderField("name", name, "姓名", "cc-name")}
        {renderField("title", title, "求职方向", "cc-title")}
        {contact && <p className="cc-contact">{contact}</p>}
        {renderField("summary", summary, "个人简介（可选）", "cc-summary")}
      </header>

      {model.preface.map((block) => renderBlock(block, { section: "简历开头" }))}

      {model.sections.map((section) => (
        <section key={section.line} className="cc-section">
          <h2 className="cc-section-title">{section.title}</h2>
          {section.blocks.map((block) => renderBlock(block, { section: section.title }))}
          {section.entries.map((entry) => {
            const raw = model.lines[entry.line];
            const parts = entry.heading.split("|").map((part) => part.trim());
            return (
              <div key={entry.line} className="cc-entry">
                {editing === entry.line ? (
                  <>
                    <LineEditor
                      label="编辑经历标题"
                      initial={entry.heading}
                      onCancel={() => {
                        setEditing(null);
                        setNotice(null);
                      }}
                      onSave={(value) => saveLine(entry.line, "### ", raw, value, false)}
                    />
                    {notice?.line === entry.line && <p className="cc-row-notice" role="alert">{notice.text}</p>}
                  </>
                ) : (
                  <Clickable
                    className={`cc-entry-heading${flash(entry.line)}`}
                    label={`编辑经历标题：${entry.heading}`}
                    onActivate={() => setEditing(entry.line)}
                  >
                    <span className="cc-entry-main">
                      <InlineText text={parts[0]} offset={raw.indexOf(parts[0])} line={entry.line} content={content} onChange={onChange} />
                      {parts[1] && (
                        <span className="cc-entry-role">
                          <InlineText text={parts[1]} offset={raw.indexOf(parts[1])} line={entry.line} content={content} onChange={onChange} />
                        </span>
                      )}
                    </span>
                    {parts.length > 2 && (
                      <span className="cc-entry-meta">
                        <InlineText
                          text={parts.slice(2).join(" | ")}
                          offset={raw.indexOf(parts.slice(2).join(" | "))}
                          line={entry.line}
                          content={content}
                          onChange={onChange}
                        />
                      </span>
                    )}
                  </Clickable>
                )}
                {entry.blocks.map((block) => renderBlock(block, { section: section.title, entry: entry.heading }))}
                {entry.blocks.length === 0 && <p className="cc-entry-empty">还没有要点，回答 AI 的追问就会补上</p>}
              </div>
            );
          })}
        </section>
      ))}
    </article>
  );
}
