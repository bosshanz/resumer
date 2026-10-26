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

describe("eight-theme collection compatibility", () => {
  it("exposes eight compositions while resolving every retired identifier", () => {
    expect(templates).toHaveLength(8);
    expect(templates.map((t) => t.id)).toEqual([
      "minimal",
      "editorial",
      "ledger",
      "authority",
      "blueprint",
      "precision",
      "scholar",
      "sidebar",
    ]);
    expect(new Set(templates.map((t) => t.name)).size).toBe(templates.length);
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
      // 网址 / 邮箱会被 <wbr> 分段，事实以可见文本为准（PDF 复制出来是同一串）
      const visible = html.replace(/<[^>]+>/g, "");
      for (const text of [
        "张三",
        "某某科技",
        "某某信息",
        "xyz-ui",
        "某某大学",
        "zhangsan@example.com",
        "本科",
      ])
        expect(visible).toContain(text);
      expect(html).toContain('class="resume-photo"');
      expect(html).not.toContain("Quiet Authority");
      expect(html).not.toContain("Systems Blueprint");
      expect(html).not.toContain("VOL ·");
    },
  );
});

describe("new themes", () => {
  const loadedFonts = [
    "--font-geist-sans",
    "--font-geist-mono",
    "--font-fraunces",
    "--font-plex-sans",
    "--font-plex-mono",
    "--font-inter-tight",
  ];
  const sample = parseResumeContent(defaultResumeContent);

  it("registers Chinese names and descriptions for the design panel", () => {
    for (const id of ["precision", "scholar", "sidebar"]) {
      const template = getTemplate(id)!;
      expect(template.id).toBe(id);
      expect(template.name).toMatch(/^[\u4e00-\u9fa5]{2}$/);
      expect(template.description.length).toBeGreaterThan(10);
    }
  });

  it("only uses fonts that the app already loads", () => {
    for (const template of templates) {
      const stacks = `${template.defaultTheme.fontFamily} ${template.defaultTheme.headingFontFamily}`;
      for (const name of stacks.match(/--font-[a-z-]+/g) ?? [])
        expect(loadedFonts).toContain(name);
    }
  });

  it("renders identity, contact, skills and every section in each new theme", () => {
    for (const id of ["precision", "scholar", "sidebar"]) {
      const { template, themeVariables } = resolveTemplateSettings(id, {});
      const html = renderToStaticMarkup(
        React.createElement(template.component, { ...sample, themeVariables, photo: "data:image/png;base64,AA==" }),
      );
      expect(html).toContain(`theme-${id}`);
      expect(html).toContain(`folio-${id}`);
      expect(html).toContain("folio-has-portrait");
      expect(html).toContain(sample.frontmatter.name!);
      expect(html).toContain("folio-skills");
      for (const section of splitResumeSections(sample.body))
        expect(html).toContain(section.title);
    }
  });

  it("puts the sidebar identity in the tinted column and keeps the profile in the main column", () => {
    const { template, themeVariables } = resolveTemplateSettings("sidebar", {});
    const html = renderToStaticMarkup(
      React.createElement(template.component, { ...sample, themeVariables }),
    );
    const rail = html.slice(html.indexOf('<aside class="folio-rail">'), html.indexOf("</aside>"));
    expect(rail).toContain('class="folio-header"');
    expect(rail).toContain("folio-contact");
    expect(rail).not.toContain("folio-profile");
    expect(html.indexOf("folio-main")).toBeGreaterThan(html.indexOf("</aside>"));
    expect(html.match(/<h1/g)).toHaveLength(1);
  });
});
