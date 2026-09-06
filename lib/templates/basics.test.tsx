import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { templates } from "./index";
import { ModernHeader } from "@/components/modern-header";
import { parseResumeContent } from "../parser";
import { defaultResumeContent } from "../types";

const { frontmatter } = parseResumeContent(defaultResumeContent);
const body = "## 工作经历\n\n### 公司 | 职位 | 2021 - 至今\n\n- 内容\n";

function renderTemplate(id: string, fm: typeof frontmatter): string {
  const template = templates.find((t) => t.id === id);
  if (!template) throw new Error(`unknown template ${id}`);
  return renderToStaticMarkup(
    React.createElement(template.component, { frontmatter: fm, body, themeVariables: {} })
  );
}

describe("basics 并入 contact", () => {
  it("每套模板都把 basics 值并入联系区（不带标签）", () => {
    for (const template of templates) {
      const html = renderTemplate(template.id, frontmatter);
      expect(html, `${template.id} 应渲染 basics 值「男」`).toContain("男");
      expect(html, `${template.id} 应渲染 basics 值「本科」`).toContain("本科");
      expect(html, `${template.id} 不应再带「性别：」标签`).not.toContain("性别");
    }
  });

  it("floating-monolith 照片布局的 ModernHeader 也并入 basics 值", () => {
    const html = renderToStaticMarkup(
      <ModernHeader frontmatter={frontmatter} photo="data:image/png;base64,x" />
    );
    expect(html).toContain("男");
    expect(html).toContain("本科");
  });

  it("空白值不渲染；键名不再展示，空键的有效值仍并入", () => {
    const blank = { ...frontmatter, basics: { 性别: "  ", 学历: " " } };
    for (const template of templates) {
      expect(renderTemplate(template.id, blank), `${template.id} 不应渲染空值条目`).not.toContain("本科");
    }
    const noLabel = { ...frontmatter, basics: { " ": "男" } };
    expect(renderTemplate("minimal", noLabel)).toContain("男");
  });

  it("basics 为空时不留下任何容器（蓝图的 Meta 面板已移除）", () => {
    const empty = { ...frontmatter, basics: {} };
    expect(renderTemplate("blueprint", empty)).not.toContain("Meta");
    expect(renderTemplate("blueprint", frontmatter)).not.toContain("Meta");
  });
});
