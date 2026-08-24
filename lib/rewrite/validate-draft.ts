import { parseResumeContent } from "../parser";
import { ResumeFrontmatter } from "../types";

export interface DraftValidation {
  ok: boolean;
  errors: string[];
  pendingItems: string[];
}

const HTML_TAG = /<\/?[a-z][\s\S]*?>/i;
const HEADING_RE = /^(#{2,3})\s+(.+?)\s*$/gm;

export function extractHeadings(markdown: string, depth: 2 | 3): string[] {
  const headings: string[] = [];
  const re = new RegExp(HEADING_RE.source, "gm");
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown))) {
    if (match[1].length === depth) {
      headings.push(normalizeHeading(match[2]));
    }
  }
  return headings;
}

export function normalizeHeading(value: string): string {
  return value.replace(/[*`_]/g, "").replace(/\s+/g, " ").trim();
}

function contactSnapshot(frontmatter: ResumeFrontmatter): Record<string, string> {
  const contact = frontmatter.contact || {};
  const snapshot: Record<string, string> = {};
  for (const key of ["phone", "email", "website", "github", "linkedin", "location"] as const) {
    const value = contact[key];
    if (value) snapshot[key] = String(value).trim();
  }
  return snapshot;
}

function isStructuralNumber(value: string): boolean {
  const token = value.trim();
  if (/^20\d{2}$/.test(token)) return true;
  if (/^\d{4}\.\d{1,2}$/.test(token)) return true;
  if (/^\d{8,}$/.test(token.replace(/\s/g, ""))) return true;
  return false;
}

export function extractNumericClaims(text: string): string[] {
  const matches = text.match(/\d+(?:\.\d+)?%|\d+(?:\.\d+)?(?:\s*)(?:k|K|w|W|万|千|百万|亿|[Ss]tars?)?/g) || [];
  const unique = new Set<string>();
  for (const raw of matches) {
    const token = raw.replace(/\s+/g, "");
    if (!token || isStructuralNumber(token)) continue;
    unique.add(token);
  }
  return [...unique];
}

function missingFrom(required: string[], actual: string[]): string[] {
  const have = new Set(actual);
  return required.filter((item) => !have.has(item));
}

function extrasIn(actual: string[], allowed: string[]): string[] {
  const have = new Set(allowed);
  return actual.filter((item) => !have.has(item));
}

export function validateDraftAgainstSource(source: string, draft: string): DraftValidation {
  const errors: string[] = [];
  const pendingItems: string[] = [];

  if (HTML_TAG.test(draft)) {
    errors.push("建议稿包含 HTML，只能使用标准 Markdown。");
  }

  const parsedDraft = parseResumeContent(draft);
  const parsedSource = parseResumeContent(source);

  if (parsedDraft.frontmatterError) {
    errors.push(parsedDraft.frontmatterError);
    return { ok: false, errors, pendingItems };
  }

  const sourceName = parsedSource.frontmatter.name?.trim();
  const draftName = parsedDraft.frontmatter.name?.trim();
  if (sourceName && sourceName !== draftName) {
    errors.push("不能修改姓名。");
  }

  const sourceContact = contactSnapshot(parsedSource.frontmatter);
  const draftContact = contactSnapshot(parsedDraft.frontmatter);
  for (const [key, value] of Object.entries(sourceContact)) {
    if (draftContact[key] !== value) {
      errors.push("不能修改联系方式。");
      break;
    }
  }

  const sourceH2 = extractHeadings(source, 2);
  const draftH2 = extractHeadings(draft, 2);
  if (missingFrom(sourceH2, draftH2).length > 0 || extrasIn(draftH2, sourceH2).length > 0) {
    errors.push("不能增删大章节标题。");
  }

  const sourceH3 = extractHeadings(source, 3);
  const draftH3 = extractHeadings(draft, 3);
  if (missingFrom(sourceH3, draftH3).length > 0 || extrasIn(draftH3, sourceH3).length > 0) {
    errors.push("不能增删经历条目，也不能改公司、职位或日期。");
  }

  const sourceNumbers = new Set(extractNumericClaims(source));
  const invented = extractNumericClaims(draft).filter((token) => !sourceNumbers.has(token));
  if (invented.length > 0) {
    pendingItems.push(`建议稿出现底稿没有的数字，已标为待补：${invented.join("、")}`);
  }

  const extraClaims = extraStrongClaims(source, draft);
  if (extraClaims.length > 0) {
    pendingItems.push(`建议稿出现底稿没有的强主张，已标为待补：${extraClaims.join("、")}`);
  }

  errors.push(...upgradedStrongClaimErrors(source, draft));

  return { ok: errors.length === 0, errors, pendingItems };
}

export function extraStrongClaims(source: string, draft: string): string[] {
  const inSource = new Set(matchStrongClaims(source));
  return matchStrongClaims(draft).filter((claim) => !inSource.has(claim));
}

const STRONG_CLAIM_PATTERN =
  /主导|负责人|Owner|从零到一|从\s*0\s*到\s*1|0\s*[→~\-]\s*1|核心作者/gi;

const CLAIM_COUNTERS: { label: string; pattern: RegExp }[] = [
  { label: "主导", pattern: /主导/g },
  { label: "负责人", pattern: /负责人/g },
  { label: "Owner", pattern: /Owner/gi },
  { label: "从零到一", pattern: /从零到一|从\s*0\s*到\s*1|0\s*[→~\-]\s*1/g },
  { label: "核心作者", pattern: /核心作者/g },
];

export function splitH3Entries(markdown: string): { heading: string; body: string }[] {
  const { body } = parseResumeContent(markdown);
  const entries: { heading: string; body: string }[] = [];
  let heading = "";
  let lines: string[] = [];

  const flush = () => {
    if (!heading) return;
    entries.push({ heading, body: lines.join("\n") });
    lines = [];
  };

  for (const line of body.split("\n")) {
    const match = /^###\s+(.+?)\s*$/.exec(line);
    if (match) {
      flush();
      heading = normalizeHeading(match[1]);
      continue;
    }
    if (heading) lines.push(line);
  }
  flush();
  return entries;
}

function countClaim(label: string, text: string): number {
  const counter = CLAIM_COUNTERS.find((item) => item.label === label);
  if (!counter) return 0;
  return [...text.matchAll(new RegExp(counter.pattern.source, counter.pattern.flags))].length;
}

export function upgradedStrongClaimErrors(source: string, draft: string): string[] {
  const errors: string[] = [];
  const sourceEntries = new Map(splitH3Entries(source).map((entry) => [entry.heading, entry.body]));

  for (const entry of splitH3Entries(draft)) {
    const sourceBody = sourceEntries.get(entry.heading);
    if (sourceBody === undefined) continue;
    for (const { label } of CLAIM_COUNTERS) {
      const before = countClaim(label, sourceBody);
      const after = countClaim(label, entry.body);
      if (after > before) {
        errors.push(
          `「${entry.heading}」中「${label}」从 ${before} 处增加到 ${after} 处。请改回较弱表述，需要补充证据时写入 pendingItems，不要写进正文。`
        );
      }
    }
  }

  return errors;
}

function matchStrongClaims(text: string): string[] {
  return normalizeClaimList(text.match(new RegExp(STRONG_CLAIM_PATTERN.source, "gi")) || []);
}

function normalizeClaimList(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const token = value.replace(/\s+/g, "");
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}
