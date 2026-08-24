import { describe, expect, it } from "vitest";
import { hasSkills, normalizeSkillGroups, resumeSkillsSchema, splitSkillTokens } from "./skills";
import { parseResumeContent } from "./parser";

describe("splitSkillTokens", () => {
  it("splits slash, pipe, and middot lists", () => {
    expect(splitSkillTokens("Java / Kotlin / Go")).toEqual(["Java", "Kotlin", "Go"]);
    expect(splitSkillTokens("Agent · RAG · Memory")).toEqual(["Agent", "RAG", "Memory"]);
  });
});

describe("normalizeSkillGroups", () => {
  it("keeps each array line as a group and splits tokens", () => {
    expect(
      normalizeSkillGroups(["Agent / RAG / Memory", "Docker / CI-CD / 可观测性"])
    ).toEqual([
      { items: ["Agent", "RAG", "Memory"] },
      { items: ["Docker", "CI-CD", "可观测性"] },
    ]);
  });

  it("turns a category object into labeled groups", () => {
    expect(
      normalizeSkillGroups({
        AI: ["Agent", "RAG / Memory"],
        Backend: "Java / Kotlin / Go",
      })
    ).toEqual([
      { label: "AI", items: ["Agent", "RAG", "Memory"] },
      { label: "Backend", items: ["Java", "Kotlin", "Go"] },
    ]);
  });

  it("treats empty input as no skills", () => {
    expect(hasSkills(undefined)).toBe(false);
    expect(hasSkills([])).toBe(false);
    expect(hasSkills({})).toBe(false);
  });
});

describe("resumeSkillsSchema", () => {
  it("accepts both list and category-object shapes", () => {
    expect(resumeSkillsSchema.parse(["React / Next.js"])).toEqual(["React / Next.js"]);
    expect(resumeSkillsSchema.parse({ AI: ["Agent", "RAG"] })).toEqual({ AI: ["Agent", "RAG"] });
  });
});

describe("parseResumeContent skills object", () => {
  it("accepts categorized skills in frontmatter", () => {
    const raw = `---
name: 韩正
skills:
  AI:
    - Agent
    - RAG
    - Memory
  Backend: [Java, Kotlin, Go]
---

## 工作经历
`;
    const { frontmatter, frontmatterError } = parseResumeContent(raw);
    expect(frontmatterError).toBeUndefined();
    expect(normalizeSkillGroups(frontmatter.skills)).toEqual([
      { label: "AI", items: ["Agent", "RAG", "Memory"] },
      { label: "Backend", items: ["Java", "Kotlin", "Go"] },
    ]);
  });
});
