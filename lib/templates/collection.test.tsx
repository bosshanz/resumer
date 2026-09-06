import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  templates,
  getTemplate,
  retiredTemplateIds,
  resolveTemplateSettings,
} from "./index";
import { splitResumeSections } from "./sections";
import { legacyDefaults } from "./legacy-defaults";
import { defaultResumeContent } from "../types";
import { parseResumeContent } from "../parser";

describe("five-theme collection compatibility", () => {
  it("exposes five compositions while resolving every retired identifier", () => {
    expect(templates).toHaveLength(5);
    for (const [old, next] of Object.entries(retiredTemplateIds))
      expect(getTemplate(old)?.id).toBe(next);
  });
  it("upgrades saved defaults and preserves intentional user adjustments", () => {
    for (const [id, defaults] of Object.entries(legacyDefaults)) {
      const result = resolveTemplateSettings(id, defaults);
      expect(result.themeVariables).toEqual(result.template.defaultTheme);
    }
    const changed = {
      ...legacyDefaults.tech,
      primaryColor: "#345678",
      baseFontSize: "12pt",
      marginLeft: "25mm",
    };
    const result = resolveTemplateSettings("tech", changed);
    expect(result.template.id).toBe("blueprint");
    expect(result.themeVariables.primaryColor).toBe("#345678");
    expect(result.themeVariables.backgroundColor).toBe(changed.backgroundColor);
    expect(result.themeVariables.baseFontSize).toBe("12pt");
    expect(result.themeVariables.marginLeft).toBe("25mm");
    expect(
      resolveTemplateSettings(result.template.id, result.themeVariables)
        .themeVariables,
    ).toEqual(result.themeVariables);
  });
  it("keeps new choices even if they match a previous default", () => {
    const current = {
      ...getTemplate("minimal")!.defaultTheme,
      baseFontSize: "10.5pt",
    };
    expect(
      resolveTemplateSettings("minimal", current).themeVariables.baseFontSize,
    ).toBe("10.5pt");
  });
  it("keeps fenced headings inside their original section and preserves rich heading links", () => {
    const body = "## [Work](https://example.com)\n\n```md\n## code sample\n```\n\n## Education\nSchool";
    expect(splitResumeSections(body)).toHaveLength(2);
    const template = templates[0];
    const html = renderToStaticMarkup(React.createElement(template.component, { frontmatter: {}, body, themeVariables: {} }));
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("## code sample");
    expect(html).toContain("School");
  });
  it.each(templates)(
    "$name retains all facts, photo and headings without decorative claims",
    (template) => {
      const { frontmatter, body } = parseResumeContent(defaultResumeContent);
      const html = renderToStaticMarkup(
        React.createElement(template.component, {
          frontmatter,
          body,
          themeVariables: {},
          photo: "data:image/png;base64,test",
        }),
      );
      for (const text of [
        "张三",
        "某某科技",
        "某某信息",
        "xyz-ui",
        "某某大学",
        "zhangsan@example.com",
        "本科",
      ])
        expect(html).toContain(text);
      expect(html).toContain('class="resume-photo"');
      expect(html).not.toContain("Quiet Authority");
      expect(html).not.toContain("Systems Blueprint");
      expect(html).not.toContain("VOL ·");
    },
  );
});
