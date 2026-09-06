import YAML from "yaml";
import { stripHiddenBlocks } from "./resume-builder";
import { ParsedResume, ResumeFrontmatter, resumeFrontmatterSchema } from "./types";

const FRONTMATTER_DELIMITER = "---";

export function parseResumeContent(raw: string): ParsedResume {
  const trimmed = raw.trim();
  const lines = trimmed.split("\n");

  // 起始和闭合分隔符都必须是整行恰为 ---（允许行尾空白）；
  // 用 indexOf("\n---") 匹配会把正文里的 ----- 或 YAML 多行字符串中的 --- 误当闭合
  if ((lines[0] ?? "").trim() !== FRONTMATTER_DELIMITER) {
    return {
      frontmatter: {},
      body: stripHiddenBlocks(trimmed),
    };
  }

  const closeIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === FRONTMATTER_DELIMITER
  );
  if (closeIndex === -1) {
    return {
      frontmatter: {},
      body: stripHiddenBlocks(trimmed),
      frontmatterError: "Frontmatter 缺少结束分隔符 ---",
    };
  }

  const frontmatterRaw = lines.slice(1, closeIndex).join("\n").trim();
  const body = lines.slice(closeIndex + 1).join("\n").trim();

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
    body: stripHiddenBlocks(body),
    frontmatterError,
  };
}

export function stringifyResumeContent(frontmatter: ResumeFrontmatter, body: string): string {
  const yaml = YAML.stringify(frontmatter, { indent: 2 });
  return `---\n${yaml}---\n\n${body.trim()}\n`;
}
