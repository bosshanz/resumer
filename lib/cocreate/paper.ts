// 主题稿面的定位逻辑：模板渲染的是经过裁剪的 Markdown 片段（去掉 frontmatter、
// 首尾空白和隐藏块），这里把片段里的一行对回原文的行号，编辑仍然落在原文上。

import { PENDING_PATTERN, type DocModel } from "./doc";

const HIDDEN_MARKER = /^\s*<!--\s*resumer-hidden-[23]:/;

export type PaperBlockKind = "li" | "h3" | "p";

export interface PaperTarget {
  /** 原文中的 0 基行号 */
  line: number;
  kind: "bullet" | "text" | "entry";
  /** 编辑时保留的行首（例如 "- " 或 "### "） */
  prefix: string;
  /** 可编辑的文字 */
  text: string;
  /** 清空后是否删除这一行（经历标题不能删，避免把要点并到上一段） */
  removable: boolean;
}

/**
 * 找到片段在原文中的起始行。片段与原文逐行对应（隐藏块被剥成空行，首行可能被去掉缩进），
 * 所以按“去空白后逐行相等”匹配；同样内容出现多次时取第一处。找不到返回 -1。
 */
export function alignSource(lines: string[], from: number, source: string): number {
  const piece = source.split("\n");
  const first = piece[0].trim();
  for (let start = from; start + piece.length <= lines.length; start += 1) {
    if (lines[start].trim() !== first) continue;
    let ok = true;
    for (let i = 1; i < piece.length && ok; i += 1) {
      const actual = lines[start + i];
      const expected = piece[i].trim();
      ok = actual.trim() === expected || (expected === "" && HIDDEN_MARKER.test(actual));
    }
    if (ok) return start;
  }
  return -1;
}

/** 按原文行号建立可编辑块索引 */
export function indexTargets(model: DocModel): Map<number, PaperTarget> {
  const index = new Map<number, PaperTarget>();
  const addBlocks = (blocks: DocModel["preface"]) => {
    for (const block of blocks) {
      if (block.type === "bullet") {
        index.set(block.line, { line: block.line, kind: "bullet", prefix: block.prefix, text: block.text, removable: true });
      } else if (block.type === "text") {
        const raw = model.lines[block.line];
        const text = raw.trim();
        index.set(block.line, { line: block.line, kind: "text", prefix: raw.slice(0, raw.length - raw.trimStart().length), text, removable: true });
      }
    }
  };
  addBlocks(model.preface);
  for (const section of model.sections) {
    addBlocks(section.blocks);
    for (const entry of section.entries) {
      index.set(entry.line, { line: entry.line, kind: "entry", prefix: "### ", text: entry.heading, removable: false });
      addBlocks(entry.blocks);
    }
  }
  return index;
}

const KIND_FOR: Record<PaperBlockKind, PaperTarget["kind"]> = { li: "bullet", h3: "entry", p: "text" };

/**
 * 把渲染出的块对回原文。块类型必须和原文一致（例如松散列表里 li 内的 p 不单独编辑），
 * 跨多行的段落不提供逐行编辑，返回 null 按原样显示。
 */
export function resolveTarget(
  model: DocModel,
  targets: Map<number, PaperTarget>,
  kind: PaperBlockKind,
  source: string,
  startLine: number,
  endLine: number,
  cache?: Map<string, number>
): PaperTarget | null {
  if (kind === "p" && endLine !== startLine) return null;
  let base = cache?.get(source);
  if (base === undefined) {
    base = alignSource(model.lines, model.bodyStart, source);
    cache?.set(source, base);
  }
  if (base < 0) return null;
  const target = targets.get(base + startLine);
  return target && target.kind === KIND_FOR[kind] ? target : null;
}

/** 选中操作需要的位置描述：所属模块与经历 */
export function locateContext(model: DocModel, line: number): { section: string; entry?: string } {
  for (const section of model.sections) {
    if (line <= section.line || line >= section.end) continue;
    const entry = section.entries.find((item) => line > item.line && line < item.end);
    return entry ? { section: section.title, entry: entry.heading } : { section: section.title };
  }
  return { section: "简历开头" };
}

export type PendingPart = { kind: "text"; text: string } | { kind: "pending"; label: string; placeholder: string };

/** 把一段文字切成普通文字与「待补」标记 */
export function splitPending(text: string): PendingPart[] {
  const parts: PendingPart[] = [];
  const pattern = new RegExp(PENDING_PATTERN.source, "g");
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) parts.push({ kind: "text", text: text.slice(last, match.index) });
    parts.push({ kind: "pending", label: match[1].trim() || "待补充", placeholder: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

/** 「待补」所在的原文行：优先给定行，否则在 [from, to) 内找第一处 */
export function findPendingLine(lines: string[], placeholder: string, preferred: number | null, from = 0, to = lines.length): number {
  if (preferred !== null && lines[preferred]?.includes(placeholder)) return preferred;
  for (let i = from; i < Math.min(to, lines.length); i += 1) if (lines[i].includes(placeholder)) return i;
  return -1;
}

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: Record<string, unknown>;
}

/** remark 插件：把正文里的「待补：…」变成可点击填写的标记。标题里不处理，以免打乱经历标题的排版 */
export function remarkPendingMarks() {
  const walk = (node: MdNode) => {
    if (!node.children || node.type === "heading") return;
    node.children = node.children.flatMap((child) => {
      if (child.type !== "text" || !child.value) {
        walk(child);
        return [child];
      }
      const parts = splitPending(child.value);
      if (parts.length === 1 && parts[0].kind === "text") return [child];
      return parts.map((part): MdNode =>
        part.kind === "text"
          ? { type: "text", value: part.text }
          : {
              type: "ccPending",
              data: {
                hName: "span",
                hProperties: { dataCcPending: part.placeholder, role: "button", tabIndex: 0, title: "点击填写" },
              },
              children: [{ type: "text", value: `待补 · ${part.label}` }],
            }
      );
    });
  };
  return (tree: MdNode) => walk(tree);
}
