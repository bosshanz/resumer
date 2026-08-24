import { MAX_BRIEF_CHARS } from "./limits";

export const MIN_BRIEF_CHARS = 4;

export function normalizeBrief(value: string): string {
  return value.trim();
}

export function briefError(value: string): string | null {
  const brief = normalizeBrief(value);
  if (brief.length < MIN_BRIEF_CHARS) {
    return "请填写改写要求，例如贴一份 JD，或写「更偏后端」";
  }
  if (value.length > MAX_BRIEF_CHARS) {
    return "改写要求过长";
  }
  return null;
}
