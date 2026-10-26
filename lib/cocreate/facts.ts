import { extractNumericClaims } from "../rewrite/validate-draft";
import { stripPending } from "./doc";

// 防编造：AI 写进简历的数字、年份、强主张词、公司名、联系方式、技能，
// 都必须能在“事实库”（用户说过的话 + 导入的旧简历 + 当前简历）里找到。
// 找不到就拒绝写入，并提示模型改用「待补：…」或先问用户。

export const STRONG_CLAIMS = [
  "主导",
  "负责人",
  "牵头",
  "带领",
  "独立负责",
  "从零到一",
  "从0到1",
  "0到1",
  "核心作者",
  "一手",
  "owner",
  "lead",
];

export type FactKind = "bullet" | "heading" | "identity" | "free" | "skill";

function squash(value: string): string {
  return value.toLowerCase().replace(/[\s,，]+/g, "");
}

function numbersIn(text: string): Set<string> {
  // 年份单独收一份：“2020.03” 既算 2020.03，也算用户说过 2020 年
  return new Set([...(text.match(/\d+(?:\.\d+)?/g) || []), ...(text.match(/(?<!\d)(?:19|20)\d{2}(?!\d)/g) || [])]);
}

export interface FactBase {
  raw: string;
  squashed: string;
  numbers: Set<string>;
}

export function buildFactBase(parts: string[]): FactBase {
  const raw = stripPending(parts.filter(Boolean).join("\n"));
  return { raw, squashed: squash(raw), numbers: numbersIn(raw) };
}

export function mentions(base: FactBase, value: string): boolean {
  const key = squash(value);
  return key.length === 0 || base.squashed.includes(key);
}

/** 返回问题列表；空数组表示可以写入 */
export function checkFacts(text: string, base: FactBase, kind: FactKind): string[] {
  const problems: string[] = [];
  if (/<\/?[a-z][^>]*>|<!--/i.test(text)) problems.push("不能写 HTML 或注释");
  if ((kind === "bullet" || kind === "heading" || kind === "identity" || kind === "skill") && /\n/.test(text)) {
    problems.push("这里只能写一行");
  }
  const body = stripPending(text);

  if (kind === "identity" || kind === "skill") {
    if (body.trim() && !mentions(base, body.trim())) {
      problems.push(`「${body.trim()}」用户没有提供过`);
    }
    return problems;
  }

  const unknownNumbers = extractNumericClaims(body).filter((claim) => {
    if (mentions(base, claim)) return false;
    const digits = claim.match(/\d+(?:\.\d+)?/)?.[0];
    return !digits || !base.numbers.has(digits);
  });
  const years = (body.match(/(?:19|20)\d{2}/g) || []).filter((year) => !base.numbers.has(year));
  const invented = [...new Set([...unknownNumbers, ...years])];
  if (invented.length) problems.push(`数字 ${invented.join("、")} 用户没有说过`);

  const lower = body.toLowerCase();
  const claims = STRONG_CLAIMS.filter((word) => lower.includes(word) && !base.raw.toLowerCase().includes(word));
  if (claims.length) problems.push(`「${claims.join("、")}」这类主导性说法用户没有说过`);

  if (kind === "heading") {
    const org = body.split("|")[0].trim();
    if (org && !mentions(base, org)) problems.push(`「${org}」这个名字用户没有提到过`);
  }
  return problems;
}

export function factError(problems: string[]): string {
  return `未写入：${problems.join("；")}。只写用户亲口给出的事实：缺的数字或细节写成「待补：要补什么」，或在回复里问用户。`;
}
