import { describe, expect, it } from "vitest";
import { parseResumeContent, stringifyResumeContent } from "./parser";
import { defaultResumeContent } from "./types";

describe("parseResumeContent", () => {
  it("解析默认简历的 frontmatter 与正文", () => {
    const { frontmatter, body, frontmatterError } = parseResumeContent(defaultResumeContent);

    expect(frontmatterError).toBeUndefined();
    expect(frontmatter.name).toBe("张三");
    expect(frontmatter.contact?.email).toBe("zhangsan@example.com");
    expect(frontmatter.skills).toContain("React / Next.js");
    expect(body.startsWith("## 工作经历")).toBe(true);
  });

  it("没有 frontmatter 时按纯 Markdown 处理", () => {
    const { frontmatter, body, frontmatterError } = parseResumeContent("## 工作经历\n\n- 内容");

    expect(frontmatter).toEqual({});
    expect(frontmatterError).toBeUndefined();
    expect(body).toBe("## 工作经历\n\n- 内容");
  });

  it("正文中的 --- 分隔线不会被误认为 frontmatter 结束符", () => {
    const raw = "---\nname: 张三\n---\n\n## 上段\n\n内容 A\n\n---\n\n## 下段\n\n内容 B";
    const { frontmatter, body, frontmatterError } = parseResumeContent(raw);

    expect(frontmatterError).toBeUndefined();
    expect(frontmatter.name).toBe("张三");
    expect(body).toContain("## 下段");
  });

  it("YAML 语法错误时返回错误信息且正文保留", () => {
    const raw = "---\nname: [未闭合\n---\n\n## 工作经历\n\n- 内容";
    const { frontmatter, body, frontmatterError } = parseResumeContent(raw);

    expect(frontmatterError).toMatch(/YAML 解析失败/);
    expect(frontmatter).toEqual({});
    expect(body).toContain("工作经历");
  });

  it("frontmatter 缺少结束分隔符时提示错误", () => {
    const { frontmatterError } = parseResumeContent("---\nname: 张三\n\n## 工作经历");

    expect(frontmatterError).toMatch(/缺少结束分隔符/);
  });

  it("字段类型不符合 schema 时返回错误信息", () => {
    const raw = "---\nname: 张三\nskills: React\n---\n\n正文";
    const { frontmatter, frontmatterError } = parseResumeContent(raw);

    expect(frontmatterError).toMatch(/字段格式不正确/);
    expect(frontmatter).toEqual({});
  });

  it("stringify 后可以重新解析出相同 frontmatter", () => {
    const { frontmatter, body } = parseResumeContent(defaultResumeContent);
    const roundTrip = parseResumeContent(stringifyResumeContent(frontmatter, body));

    expect(roundTrip.frontmatterError).toBeUndefined();
    expect(roundTrip.frontmatter).toEqual(frontmatter);
  });
});
