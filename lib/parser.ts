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
      frontmatterError: "Frontmatter 缺少结束分隔符 ---",
    };
  }

  const frontmatterRaw = trimmed.slice(FRONTMATTER_DELIMITER.length, endIndex).trim();
  const body = trimmed.slice(endIndex + FRONTMATTER_DELIMITER.length + 1).trim();

  let frontmatter: ResumeFrontmatter = {};
  let frontmatterError: string | undefined;
  try {
    const parsed = YAML.parse(frontmatterRaw);
    const result = resumeFrontmatterSchema.safeParse(parsed || {});
    if (result.success) {
      frontmatter = result.data;
    } else {
      const detail = result.error.issues
        .map((issue) => `${issue.path.join(".") || "(根字段)"}: ${issue.message}`)
        .join("；");
      frontmatterError = `Frontmatter 字段格式不正确（${detail}）`;
    }
  } catch (err) {
    frontmatterError = `Frontmatter YAML 解析失败：${err instanceof Error ? err.message : String(err)}`;
  }

  return {
    frontmatter,
    body,
    frontmatterError,
  };
}

export function stringifyResumeContent(frontmatter: ResumeFrontmatter, body: string): string {
  const yaml = YAML.stringify(frontmatter, { indent: 2 });
  return `---\n${yaml}---\n\n${body.trim()}\n`;
}
