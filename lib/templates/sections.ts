import { splitPieces } from "../resume-builder";
export interface ResumeSection {
  title: string;
  body: string;
  heading?: string;
}

// basics：frontmatter 自由键值（性别/学历等）。展示时只取值、不带标签，
// 作为匿名的联系片段并入各模板的 contact 区；空值与空键都不渲染
export function basicsValues(basics?: Record<string, string>): string[] {
  return Object.values(basics ?? {})
    .map((value) => value.trim())
    .filter((value) => value !== "");
}

export function splitResumeSections(markdown: string): ResumeSection[] {
  return splitPieces(markdown, 2)
    .filter((piece) => piece.raw.trim())
    .map((piece) => ({
      title: piece.heading ? piece.title : "简历详情",
      heading: piece.heading || undefined,
      body: piece.body.trim(),
    }));
}
