import { z } from "zod";

export interface SkillGroup {
  label?: string;
  items: string[];
}

const skillLeaf = z.union([z.string(), z.number(), z.boolean()]).transform((value) => String(value).trim());

export const resumeSkillsSchema = z
  .union([
    z.array(skillLeaf),
    z.record(z.string(), z.union([skillLeaf, z.array(skillLeaf)])),
  ])
  .optional();

export type ResumeSkills = z.infer<typeof resumeSkillsSchema>;

// 斜杠只有带空格时才是分隔符："Java / Go" 拆成两项，
// 而 A/B Testing、CI/CD、TCP/IP 这类术语本身含斜杠，必须保持完整。
export function splitSkillTokens(value: string): string[] {
  return value
    .split(/\s*(?:·+|,|，|\|)\s*|\s+\/+\s*|\s*\/+\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeSkillGroups(skills: ResumeSkills | undefined): SkillGroup[] {
  if (!skills) return [];

  if (Array.isArray(skills)) {
    return skills
      .map((line) => ({ items: splitSkillTokens(line) }))
      .filter((group) => group.items.length > 0);
  }

  return Object.entries(skills)
    .map(([label, value]) => {
      const items = Array.isArray(value)
        ? value.flatMap((item) => splitSkillTokens(item))
        : splitSkillTokens(value);
      return { label: label.trim(), items };
    })
    .filter((group) => Boolean(group.label) && group.items.length > 0);
}

export function hasSkills(skills: ResumeSkills | undefined): boolean {
  return normalizeSkillGroups(skills).length > 0;
}
