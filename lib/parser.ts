import YAML from "yaml";
import { ParsedResume, ResumeFrontmatter, resumeFrontmatterSchema } from "./types";

const FRONTMATTER_DELIMITER = "---";

export function parseResumeContent(raw: string): ParsedResume {
  const trimmed = raw.trim();

  if (!trimmed.startsWith(FRONTMATTER_DELIMITER)) {
    return {
      frontmatter: {},
      body: trimmed,
    };
  }

  const endIndex = trimmed.indexOf("\n" + FRONTMATTER_DELIMITER);
  if (endIndex === -1) {
    return {
      frontmatter: {},
      body: trimmed,
    };
  }

  const frontmatterRaw = trimmed.slice(FRONTMATTER_DELIMITER.length, endIndex).trim();
  const body = trimmed.slice(endIndex + FRONTMATTER_DELIMITER.length + 1).trim();

  let frontmatter: ResumeFrontmatter = {};
  try {
    const parsed = YAML.parse(frontmatterRaw);
    const result = resumeFrontmatterSchema.safeParse(parsed || {});
    if (result.success) {
      frontmatter = result.data;
    }
  } catch {
    frontmatter = {};
  }

  return {
    frontmatter,
    body,
  };
}

export function stringifyResumeContent(frontmatter: ResumeFrontmatter, body: string): string {
  const yaml = YAML.stringify(frontmatter, { indent: 2 });
  return `---\n${yaml}---\n\n${body.trim()}\n`;
}
