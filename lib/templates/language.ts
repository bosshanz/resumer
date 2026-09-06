import type { ResumeFrontmatter } from "../types";

export function getResumeLanguage(frontmatter: ResumeFrontmatter, body: string): "zh-CN" | "en" {
  return /\p{Script=Han}/u.test([frontmatter.name, frontmatter.title, frontmatter.summary, body].join(" "))
    ? "zh-CN"
    : "en";
}
