import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { parseDocument, isMap, isAlias } from "yaml";
import type { RootContent } from "mdast";
import { resumeFrontmatterSchema } from "./types";

const parser = unified().use(remarkParse).use(remarkGfm);
export interface Piece {
  raw: string;
  hidden: boolean;
  level: number;
  title: string;
  heading: string;
  body: string;
}
export interface BuilderDocument {
  front: string;
  body: string;
  sections: Piece[];
  fields: Record<string, unknown>;
  error: string | null;
}
const marker = /^<!-- resumer-hidden-(2|3):([A-Za-z0-9+/=]+) -->/;
function encode(value: string) {
  return btoa(
    Array.from(new TextEncoder().encode(value), (c) =>
      String.fromCharCode(c),
    ).join(""),
  );
}
function decode(value: string) {
  return new TextDecoder("utf-8", { fatal: true }).decode(
    Uint8Array.from(atob(value), (c) => c.charCodeAt(0)),
  );
}
function textOf(node: RootContent): string {
  if ("value" in node) return node.value;
  if ("children" in node)
    return node.children.map((n) => textOf(n as RootContent)).join("");
  return "";
}
function piece(raw: string, level: number): Piece {
  const match = marker.exec(raw);
  if (match && Number(match[1]) === level) {
    try {
      const restored = piece(decode(match[2]), level);
      if (
        restored.heading &&
        !restored.hidden &&
        !raw.slice(match[0].length).trim()
      )
        return { ...restored, raw, hidden: true };
    } catch {
      /* Malformed annotations remain ordinary Markdown. */
    }
  }
  const node = parser.parse(raw).children[0];
  const isHeading = node?.type === "heading" && node.depth === level;
  const end = isHeading ? node.position!.end.offset! : 0;
  return {
    raw,
    level,
    hidden: false,
    title: isHeading ? textOf(node) : "自由内容",
    heading: raw.slice(0, end),
    body: raw.slice(end),
  };
}
export function visibleRaw(value: Piece): string {
  if (!value.hidden) return value.raw;
  return decode(marker.exec(value.raw)![2]);
}
export function splitPieces(source: string, level: number): Piece[] {
  const starts = parser.parse(source).children.flatMap((node) => {
    const hidden = node.type === "html" && marker.exec(node.value);
    if (
      (node.type === "heading" && node.depth === level) ||
      (hidden && Number(hidden[1]) === level)
    )
      return [node.position!.start.offset!];
    return [];
  });
  if (!starts.length) return source ? [piece(source, level)] : [];
  if (starts[0] !== 0) starts.unshift(0);
  return starts.map((start, i) =>
    piece(source.slice(start, starts[i + 1] ?? source.length), level),
  );
}
export function readBuilder(source: string): BuilderDocument {
  const match =
    /^(\s*---[^\S\n]*\r?\n)([\s\S]*?)(^---[^\S\n]*(?:\r?\n|$))/m.exec(source);
  const front = match?.index === 0 ? match[0] : "";
  const body = source.slice(front.length);
  let fields: Record<string, unknown> = {};
  let error: string | null = null;
  if (front) {
    const doc = parseDocument(match![2]);
    if (doc.errors.length || (doc.contents !== null && !isMap(doc.contents)))
      error = "基本信息格式需要在 Markdown 模式修复；正文仍可编辑。";
    else {
      try {
        fields = (doc.toJS({ maxAliasCount: 100 }) ?? {}) as Record<
          string,
          unknown
        >;
        if (!resumeFrontmatterSchema.safeParse(fields).success)
          error = "基本信息字段格式不兼容，请在 Markdown 模式修复。";
      } catch {
        error = "基本信息包含无法展开的引用，请在 Markdown 模式编辑。";
      }
    }
  } else if (/^\s*---\s*\n/.test(source))
    error = "基本信息的分隔符未闭合，请在 Markdown 模式修复。";
  return { front, body, sections: splitPieces(body, 2), fields, error };
}
export function patchField(
  source: string,
  path: string[],
  value: unknown,
): string {
  const model = readBuilder(source);
  if (model.error) return source;
  const yaml = model.front
    ? model.front
        .replace(/^\s*---[^\S\n]*\r?\n/, "")
        .replace(/^---[^\S\n]*(?:\r?\n|$)$/m, "")
    : "{}";
  const doc = parseDocument(yaml);
  if (path.length > 1 && isAlias(doc.getIn([path[0]])))
    doc.setIn([path[0]], doc.createNode(model.fields[path[0]]));
  if (value === undefined) doc.deleteIn(path);
  else doc.setIn(path, value);
  return `---\n${doc.toString()}---\n${model.body}`;
}
export function replacePiece(value: Piece, raw: string): Piece {
  return value.hidden
    ? {
        ...piece(
          `<!-- resumer-hidden-${value.level}:${encode(raw)} -->\n\n`,
          value.level,
        ),
      }
    : piece(raw, value.level);
}
export function togglePiece(value: Piece): Piece {
  return value.hidden
    ? piece(visibleRaw(value), value.level)
    : piece(
        `<!-- resumer-hidden-${value.level}:${encode(value.raw)} -->\n\n`,
        value.level,
      );
}
export function joinPieces(values: Piece[]): string {
  return values.map((p) => p.raw).join("");
}
export function orderedPieces(values: Piece[]): string {
  return values
    .map(
      (p, i) =>
        p.raw +
        (i < values.length - 1 && !p.raw.endsWith("\n\n") ? "\n\n" : ""),
    )
    .join("");
}
export function makePiece(title: string, level: number): Piece {
  return piece(`${"#".repeat(level)} ${title}\n\n`, level);
}
export function editHeading(value: Piece, title: string): Piece {
  return replacePiece(
    value,
    `${"#".repeat(value.level)} ${title.replace(/[\r\n]+/g, " ")}\n${value.body.replace(/^\r?\n/, "")}`,
  );
}
export function editPieceBody(value: Piece, body: string, tail = ""): Piece {
  const separated = body + (body.endsWith("\n\n") ? "" : "\n\n");
  return replacePiece(
    value,
    value.heading + (value.heading ? "\n\n" : "") + separated + tail,
  );
}
export function richTextSafe(source: string): boolean {
  const allowed = new Set([
    "root",
    "paragraph",
    "text",
    "strong",
    "emphasis",
    "delete",
    "link",
    "break",
    "list",
    "listItem",
  ]);
  function safe(node: {
    type: string;
    children?: unknown[];
    checked?: boolean | null;
  }): boolean {
    return (
      allowed.has(node.type) &&
      node.checked == null &&
      (!node.children || node.children.every((n) => safe(n as typeof node)))
    );
  }
  return safe(parser.parse(source));
}

/** Presentation only: persistence and the builder retain the reversible source. */
export function stripHiddenBlocks(source: string): string {
  if (!source.includes("<!-- resumer-hidden-")) return source;
  const removals = parser.parse(source).children.flatMap((node) => {
    if (node.type !== "html") return [];
    const match = marker.exec(node.value);
    if (!match || !piece(node.value, Number(match[1])).hidden) return [];
    return [
      { start: node.position!.start.offset!, end: node.position!.end.offset! },
    ];
  });
  let result = source;
  for (const range of removals.reverse())
    result = result.slice(0, range.start) + result.slice(range.end);
  return result;
}
