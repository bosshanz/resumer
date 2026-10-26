import { patchField, readBuilder } from "../resume-builder";
import { findEntry, findSection, headingLevel, parseDoc, splitLines } from "./doc";

// AI 对简历的每一次修改都是一条可逆的结构化编辑，绝不整篇重写。
// - field：frontmatter 某个字段从 before 改成 after
// - lines：在某个作用域（分区 / 经历）里，把唯一出现的一段连续行 before 换成 after；
//   before 为空表示追加到作用域末尾
// 撤销 = 应用反向编辑；当前内容和 before 对不上（被人改过）就拒绝，不硬覆盖。

export interface EditScope {
  section?: string;
  entry?: string;
}

export type ResumeEdit =
  | { kind: "field"; path: string[]; before?: unknown; after?: unknown }
  | { kind: "lines"; scope: EditScope; before: string[]; after: string[] };

export type ApplyResult = { ok: true; content: string } | { ok: false; reason: string };

const NO_FRONTMATTER = /^\s*---[^\S\n]*\r?\n/;

export function getField(fields: Record<string, unknown>, path: string[]): unknown {
  let cursor: unknown = fields;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function emptyish(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (emptyish(a) && emptyish(b)) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function readFieldValue(content: string, path: string[]): { ok: true; value: unknown } | { ok: false; reason: string } {
  const model = readBuilder(content);
  if (model.error) return { ok: false, reason: `简历头部 YAML 有误：${model.error}` };
  return { ok: true, value: getField(model.fields as Record<string, unknown>, path) };
}

interface Range {
  start: number;
  end: number;
}

export function resolveScope(content: string, scope: EditScope): Range | string {
  const model = parseDoc(content);
  if (!scope.section) return { start: model.bodyStart, end: model.lines.length };
  const section = findSection(model, scope.section);
  if (!section) return `找不到分区「${scope.section}」`;
  if (!scope.entry) return { start: section.line, end: section.end };
  const entry = findEntry(section, scope.entry);
  if (!entry) return `分区「${section.title}」里找不到经历「${scope.entry}」`;
  return { start: entry.line, end: entry.end };
}

function same(a: string, b: string): boolean {
  return a.trimEnd() === b.trimEnd();
}

function occurrences(lines: string[], range: Range, needle: string[]): number[] {
  const hits: number[] = [];
  for (let i = range.start; i + needle.length <= range.end; i += 1) {
    if (needle.every((line, k) => same(lines[i + k], line))) hits.push(i);
  }
  return hits;
}

function lastNonBlank(lines: string[], range: Range): number {
  for (let i = range.end - 1; i >= range.start; i -= 1) {
    if (lines[i].trim()) return i;
  }
  return range.start - 1;
}

// 删掉一个标题时，它下面的内容会被并进上一个标题，等于悄悄改了结构；只允许删“空”标题
function removesHeadingSafely(before: string[], after: string[], following: string | undefined): boolean {
  const removed = before.filter((line) => headingLevel(line) && !after.some((kept) => same(kept, line)));
  if (removed.length === 0) return true;
  const level = Math.min(...removed.map((line) => headingLevel(line)));
  if (following === undefined) return true;
  const next = headingLevel(following);
  return next !== 0 && next <= level;
}

function applyLinesEdit(content: string, edit: Extract<ResumeEdit, { kind: "lines" }>): ApplyResult {
  const range = resolveScope(content, edit.scope);
  if (typeof range === "string") return { ok: false, reason: range };
  const lines = splitLines(content);

  if (edit.before.length === 0) {
    const at = lastNonBlank(lines, range) + 1;
    lines.splice(at, 0, ...edit.after);
    return { ok: true, content: lines.join("\n") };
  }

  const hits = occurrences(lines, range, edit.before);
  if (hits.length === 0) return { ok: false, reason: "要修改的内容已经不在了，可能刚被手动改过" };
  if (hits.length > 1) return { ok: false, reason: "要修改的内容出现了多次，无法确定是哪一处" };
  const at = hits[0];
  const following = lines.slice(at + edit.before.length).find((line) => line.trim());
  if (!removesHeadingSafely(edit.before, edit.after, following)) {
    return { ok: false, reason: "这个标题下面还有内容，不能直接删掉标题" };
  }
  lines.splice(at, edit.before.length, ...edit.after);
  return { ok: true, content: lines.join("\n") };
}

function applyFieldEdit(content: string, edit: Extract<ResumeEdit, { kind: "field" }>): ApplyResult {
  const source = NO_FRONTMATTER.test(content) ? content : `---\n---\n${content}`;
  const current = readFieldValue(source, edit.path);
  if (!current.ok) return current;
  if (!sameValue(current.value, edit.before)) {
    return { ok: false, reason: `「${edit.path.join(".")}」已经被改成了别的内容` };
  }
  const after = emptyish(edit.after) ? undefined : edit.after;
  return { ok: true, content: patchField(source, edit.path, after) };
}

export function applyEdit(content: string, edit: ResumeEdit): ApplyResult {
  return edit.kind === "field" ? applyFieldEdit(content, edit) : applyLinesEdit(content, edit);
}

export function invertEdit(edit: ResumeEdit): ResumeEdit {
  if (edit.kind === "field") return { ...edit, before: edit.after, after: edit.before };
  if (edit.before.length === 0) {
    // 追加的反向：删除追加的那几行（作用域不变）
    return { kind: "lines", scope: edit.scope, before: edit.after, after: [] };
  }
  return { kind: "lines", scope: edit.scope, before: edit.after, after: edit.before };
}

/** 这条编辑的结果是否已经体现在内容里（用于保存时的重放去重） */
export function isEditApplied(content: string, edit: ResumeEdit): boolean {
  if (edit.kind === "field") {
    const current = readFieldValue(content, edit.path);
    return current.ok && sameValue(current.value, edit.after);
  }
  const range = resolveScope(content, edit.scope);
  if (typeof range === "string") return false;
  const lines = splitLines(content);
  const inRange = new Set(lines.slice(range.start, range.end).map(normalizeLine));
  const after = edit.after.map(normalizeLine).filter(Boolean);
  const before = edit.before.map(normalizeLine).filter(Boolean);
  if (after.length === 0) return before.length > 0 && before.every((line) => !inRange.has(line));
  const hasAfter = after.every((line) => inRange.has(line));
  const lacksBefore = edit.before.length === 0 || occurrences(lines, range, edit.before).length === 0;
  return hasAfter && lacksBefore;
}

/**
 * 浏览器保存的内容可能基于 AI 编辑之前的版本（保存与 AI 写入交错）。
 * 服务端把客户端还没见过的 AI 编辑重放到这份内容上：已体现的跳过，能干净应用的补上，
 * 冲突的放弃（以人工内容为准）。
 */
export function rebaseEdits(content: string, edits: ResumeEdit[]): { content: string; dropped: number } {
  let next = content;
  let dropped = 0;
  for (const edit of edits) {
    if (isEditApplied(next, edit)) continue;
    const result = applyEdit(next, edit);
    if (result.ok) next = result.content;
    else dropped += 1;
  }
  return { content: next, dropped };
}

// ---- 人工改动识别 ----

export interface HumanChanges {
  addedLines: string[];
  removedLines: string[];
  fields: string[];
}

const TRACKED_FIELDS = [
  ["name"],
  ["title"],
  ["summary"],
  ["contact", "phone"],
  ["contact", "email"],
  ["contact", "github"],
  ["contact", "website"],
  ["contact", "linkedin"],
  ["contact", "location"],
  ["skills"],
  ["basics"],
];

export function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, " ");
}

function bodyLines(content: string): string[] {
  const model = parseDoc(content);
  return model.lines.slice(model.bodyStart).map(normalizeLine).filter(Boolean);
}

function multisetDiff(a: string[], b: string[]): string[] {
  const counts = new Map<string, number>();
  for (const line of b) counts.set(line, (counts.get(line) || 0) + 1);
  const out: string[] = [];
  for (const line of a) {
    const n = counts.get(line) || 0;
    if (n > 0) counts.set(line, n - 1);
    else out.push(line);
  }
  return out;
}

/** reference = AI 上次看到的内容；current = 现在的内容。差异就是人工改动 */
export function diffHumanChanges(reference: string, current: string): HumanChanges {
  const before = bodyLines(reference);
  const after = bodyLines(current);
  const ref = readBuilder(reference);
  const cur = readBuilder(current);
  const fields: string[] = [];
  if (!cur.error) {
    for (const path of TRACKED_FIELDS) {
      const a = getField(ref.fields as Record<string, unknown>, path);
      const b = getField(cur.fields as Record<string, unknown>, path);
      if (!sameValue(a, b)) fields.push(path.join("."));
    }
  }
  return {
    addedLines: multisetDiff(after, before),
    removedLines: multisetDiff(before, after),
    fields,
  };
}

export function hasHumanChanges(changes: HumanChanges): boolean {
  return changes.addedLines.length + changes.removedLines.length + changes.fields.length > 0;
}

export function editTouchesLines(edit: ResumeEdit): string[] {
  return edit.kind === "lines" ? edit.before.map(normalizeLine).filter(Boolean) : [];
}

/** 简历是否还是空白（没有姓名，正文也没有内容），用于决定“从零开始”是否需要新建 */
export function isResumeBlank(content: string): boolean {
  const { fields, body } = readBuilder(content);
  const filled = Object.values(fields).some((value) => !sameValue(value, ""));
  return !filled && !body.trim();
}
