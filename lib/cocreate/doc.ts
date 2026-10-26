// 共创稿面的行级文档模型。只做无损的“按行”解析：
// 任何编辑都落成对原文某几行的替换，未识别的内容原样保留。

export const FRONTMATTER_PATTERN = /^(\s*---[^\S\n]*\r?\n)([\s\S]*?)(^---[^\S\n]*(?:\r?\n|$))/m;

export type DocBlock =
  | { type: "bullet"; line: number; prefix: string; text: string }
  | { type: "text"; line: number; text: string }
  | { type: "hidden"; line: number };

export interface DocEntry {
  line: number;
  heading: string;
  blocks: DocBlock[];
  end: number;
}

export interface DocSection {
  line: number;
  title: string;
  blocks: DocBlock[];
  entries: DocEntry[];
  end: number;
}

export interface DocModel {
  lines: string[];
  bodyStart: number;
  preface: DocBlock[];
  sections: DocSection[];
}

const H2 = /^##(?!#)\s+(.*?)\s*#*\s*$/;
const H3 = /^###(?!#)\s+(.*?)\s*$/;
const BULLET = /^(\s{0,3}[-*+]\s+)(.*)$/;
const HIDDEN = /^\s*<!--\s*resumer-hidden-[23]:/;
const FENCE = /^\s*(```|~~~)/;

export function splitLines(content: string): string[] {
  return content.split("\n");
}

export function frontmatterLineCount(content: string): number {
  const match = FRONTMATTER_PATTERN.exec(content);
  if (!match || match.index !== 0) return 0;
  return match[0].split("\n").length - (match[0].endsWith("\n") ? 1 : 0);
}

export function headingLevel(line: string): 0 | 2 | 3 {
  if (H2.test(line)) return 2;
  if (H3.test(line)) return 3;
  return 0;
}

export function parseDoc(content: string): DocModel {
  const lines = splitLines(content);
  const bodyStart = frontmatterLineCount(content);
  const preface: DocBlock[] = [];
  const sections: DocSection[] = [];
  let section: DocSection | null = null;
  let entry: DocEntry | null = null;
  let inFence = false;

  const target = (): DocBlock[] => (entry ? entry.blocks : section ? section.blocks : preface);

  for (let i = bodyStart; i < lines.length; i += 1) {
    const raw = lines[i];
    if (FENCE.test(raw)) inFence = !inFence;
    if (!inFence) {
      const h2 = H2.exec(raw);
      if (h2) {
        if (entry) entry.end = i;
        if (section) section.end = i;
        section = { line: i, title: h2[1].trim(), blocks: [], entries: [], end: lines.length };
        sections.push(section);
        entry = null;
        continue;
      }
      const h3 = H3.exec(raw);
      if (h3 && section) {
        if (entry) entry.end = i;
        entry = { line: i, heading: h3[1].trim(), blocks: [], end: lines.length };
        section.entries.push(entry);
        continue;
      }
      if (HIDDEN.test(raw)) {
        target().push({ type: "hidden", line: i });
        continue;
      }
      const bullet = BULLET.exec(raw);
      if (bullet) {
        target().push({ type: "bullet", line: i, prefix: bullet[1], text: bullet[2] });
        continue;
      }
    }
    if (raw.trim()) target().push({ type: "text", line: i, text: raw });
  }
  if (entry) entry.end = section?.end ?? lines.length;
  return { lines, bodyStart, preface, sections };
}

export function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

export function findSection(model: DocModel, title: string): DocSection | undefined {
  const key = normalizeTitle(title);
  return model.sections.find((section) => normalizeTitle(section.title) === key);
}

/** 先精确匹配整行标题，再按第一个 `|` 段（公司 / 项目名）匹配；多条命中视为不唯一 */
export function findEntry(section: DocSection, query: string): DocEntry | undefined {
  const key = normalizeTitle(query);
  const exact = section.entries.filter((entry) => normalizeTitle(entry.heading) === key);
  if (exact.length === 1) return exact[0];
  const head = normalizeTitle(query.split("|")[0]);
  const byHead = section.entries.filter(
    (entry) => normalizeTitle(entry.heading.split("|")[0]) === head
  );
  return byHead.length === 1 ? byHead[0] : undefined;
}

export function entryOrganization(heading: string): string {
  return heading.split("|")[0].trim();
}

// ---- 待补 ----

export const PENDING_PATTERN = /「待补[:：]\s*([^」\n]*)」/g;

export interface PendingItem {
  line: number;
  start: number;
  end: number;
  label: string;
  placeholder: string;
  lineText: string;
}

export function extractPending(content: string): PendingItem[] {
  const items: PendingItem[] = [];
  splitLines(content).forEach((lineText, line) => {
    for (const match of lineText.matchAll(PENDING_PATTERN)) {
      const start = match.index ?? 0;
      items.push({
        line,
        start,
        end: start + match[0].length,
        label: match[1].trim() || "待补充",
        placeholder: match[0],
        lineText,
      });
    }
  });
  return items;
}

export function stripPending(text: string): string {
  return text.replace(PENDING_PATTERN, " ");
}

/** 用用户填写的值替换一个「待补」。位置失效时按占位文本找第一处 */
export function fillPending(content: string, item: Pick<PendingItem, "line" | "start" | "placeholder">, value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  const lines = splitLines(content);
  const current = lines[item.line];
  if (current !== undefined && current.slice(item.start, item.start + item.placeholder.length) === item.placeholder) {
    lines[item.line] = current.slice(0, item.start) + text + current.slice(item.start + item.placeholder.length);
    return lines.join("\n");
  }
  const index = content.indexOf(item.placeholder);
  if (index < 0) return null;
  return content.slice(0, index) + text + content.slice(index + item.placeholder.length);
}

// ---- 行操作（稿面编辑用） ----

export function replaceLine(content: string, line: number, text: string): string {
  const lines = splitLines(content);
  if (line < 0 || line >= lines.length) return content;
  lines[line] = text;
  return lines.join("\n");
}

export function insertLinesAfter(content: string, line: number, added: string[]): string {
  const lines = splitLines(content);
  lines.splice(line + 1, 0, ...added);
  return lines.join("\n");
}

export function removeLines(content: string, line: number, count = 1): string {
  const lines = splitLines(content);
  lines.splice(line, count);
  return lines.join("\n");
}

/**
 * 稿面里的一行在失焦时才提交。期间 AI 可能在上方插入内容导致行号漂移，
 * 所以按“原文本”就近重新定位。原文本已不在（同一行刚被改过）时返回 null，
 * 由界面保留输入并提示，不去猜位置覆盖别的内容。
 */
/** 找到要改的那一行：优先原位置，其次离原位置最近的同文本行；原文已不在时返回 -1 */
export function locateLine(lines: string[], hint: number, original: string): number {
  if (lines[hint] === original) return hint;
  let best = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] === original && (best < 0 || Math.abs(i - hint) < Math.abs(best - hint))) best = i;
  }
  return best;
}

/**
 * 稿面上的人工编辑：按行替换。编辑期间 AI 可能改了这一行，
 * 原文已不在时返回 null，由界面提示用户，而不是盲目覆盖。
 * next 为 null 表示删除这一行。
 */
export function commitLineEdit(content: string, hint: number, original: string, next: string | null): string | null {
  const lines = splitLines(content);
  const index = locateLine(lines, hint, original);
  if (index < 0) return null;
  if (next === null) lines.splice(index, 1);
  else lines[index] = next;
  return lines.join("\n");
}
