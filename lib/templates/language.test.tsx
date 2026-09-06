import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorialTemplate } from "./editorial";
import { BlueprintTemplate } from "./blueprint";
import { getResumeLanguage } from "./language";

describe("content-aware theme typography", () => {
  it("recognizes Chinese body content even with an English name", () => {
    expect(getResumeLanguage({ name: "Andy" }, "## 工作经历")).toBe("zh-CN");
    expect(getResumeLanguage({ name: "Andy" }, "## Experience")).toBe("en");
  });
  it("disables drop caps for Chinese and numeric English summaries", () => {
    for (const summary of ["8 年开发经验", "8 years of experience"]) {
      const html = renderToStaticMarkup(<EditorialTemplate frontmatter={{ summary }} body="" themeVariables={{}} />);
      expect(html).not.toContain('class="resume-dropcap"');
    }
    const html = renderToStaticMarkup(<EditorialTemplate frontmatter={{ summary: "Experienced engineer" }} body="" themeVariables={{}} />);
    expect(html).toContain('class="resume-dropcap"');
  });
  it("does not invent a specialization for a blueprint resume", () => {
    const html = renderToStaticMarkup(<BlueprintTemplate frontmatter={{ name: "李四", title: "财务经理" }} body="" themeVariables={{}} />);
    expect(html).toContain("财务经理");
    expect(html).not.toContain("前端工程化");
    expect(html).toContain('lang="zh-CN"');
  });
});
