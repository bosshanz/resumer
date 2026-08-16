import { describe, expect, it } from "vitest";
import { splitResumeSections } from "./sections";
import { defaultResumeContent } from "../types";
import { parseResumeContent } from "../parser";

describe("splitResumeSections", () => {
  it("默认简历拆分为工作经历、项目经历、教育背景", () => {
    const { body } = parseResumeContent(defaultResumeContent);
    const sections = splitResumeSections(body);

    expect(sections.map((s) => s.title)).toEqual(["工作经历", "项目经历", "教育背景"]);
    expect(sections[0].body).toContain("高级前端工程师");
  });

  it("第一个 ## 之前的 preamble 归入默认小节", () => {
    const sections = splitResumeSections("自我介绍\n\n## 工作经历\n\n- 内容");

    expect(sections).toHaveLength(2);
    expect(sections[0]).toEqual({ title: "简历详情", body: "自我介绍" });
    expect(sections[1].title).toBe("工作经历");
  });

  it("### 标题保留在小节正文内", () => {
    const sections = splitResumeSections("## 工作经历\n\n### 公司 | 职位\n\n- 内容");

    expect(sections).toHaveLength(1);
    expect(sections[0].body).toContain("### 公司 | 职位");
  });

  it("只有标题没有正文的小节仍然保留", () => {
    const sections = splitResumeSections("## 工作经历\n\n- 内容\n\n## 教育背景");

    expect(sections.map((s) => s.title)).toEqual(["工作经历", "教育背景"]);
    expect(sections[1].body).toBe("");
  });

  it("标题行尾部空白被去除", () => {
    const sections = splitResumeSections("## 工作经历  \n\n- 内容");

    expect(sections[0].title).toBe("工作经历");
  });

  it("空字符串返回空数组", () => {
    expect(splitResumeSections("")).toEqual([]);
    expect(splitResumeSections("   \n  ")).toEqual([]);
  });
});
