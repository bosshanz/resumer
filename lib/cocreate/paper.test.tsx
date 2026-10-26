import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { parseDoc } from "./doc";
import { alignSource, findPendingLine, indexTargets, locateContext, remarkPendingMarks, resolveTarget, splitPending } from "./paper";
import { parseResumeContent } from "../parser";
import { splitResumeSections } from "../templates/sections";
import { ResumeMarkdown } from "../templates/resume-markdown";
import { resolveTemplateSettings } from "../templates";
import type { ResumeEditing } from "../templates/editing";
import { makePiece, togglePiece } from "../resume-builder";

const hidden = togglePiece(makePiece("隐藏的经历", 3)).raw.trim();
const content = [
  "---",
  "name: 张三",
  "title: 「待补：求职方向」",
  "---",
  "",
  "## 工作经历",
  "",
  "### 字节跳动 | 后端工程师 | 2021 - 至今",
  "",
  "- 负责推荐服务重构，延迟下降 40%",
  "- 带 3 人小组完成「待补：项目名」上线",
  "",
  hidden,
  "",
  "### 某公司 | 实习",
  "",
  "- 负责推荐服务重构，延迟下降 40%",
  "",
  "## 教育",
  "",
  "清华大学 计算机 本科",
  "第二行说明",
  "",
  "**荣誉**",
].join("\n");

describe("alignSource", () => {
  it("maps a trimmed section body back to content lines, matching hidden markers as blank", () => {
    const { body } = parseResumeContent(content);
    const sections = splitResumeSections(body);
    const model = parseDoc(content);
    const work = sections.find((section) => (section.heading ?? section.title).includes("工作经历"))!;
    const start = alignSource(model.lines, model.bodyStart, work.body);
    expect(model.lines[start]).toBe("### 字节跳动 | 后端工程师 | 2021 - 至今");
    expect(work.body).not.toContain("resumer-hidden");
    expect(hidden).not.toContain("\n");
    // 隐藏块之后的经历仍能对上原文
    const lines = work.body.split("\n");
    const internship = lines.indexOf("### 某公司 | 实习");
    expect(model.lines[start + internship]).toBe("### 某公司 | 实习");
  });

  it("returns -1 when the piece is not in the content", () => {
    const model = parseDoc(content);
    expect(alignSource(model.lines, model.bodyStart, "- 不存在的要点")).toBe(-1);
  });

  it("takes the first occurrence for identical pieces", () => {
    const model = parseDoc(content);
    expect(alignSource(model.lines, model.bodyStart, "- 负责推荐服务重构，延迟下降 40%")).toBe(9);
  });
});

describe("resolveTarget", () => {
  const model = parseDoc(content);
  const targets = indexTargets(model);
  const work = splitResumeSections(parseResumeContent(content).body).find((section) => (section.heading ?? section.title).includes("工作经历"))!.body;
  const workLines = work.split("\n");
  const rel = (text: string) => workLines.findIndex((line) => line === text);

  it("resolves list items, entry headings and their kinds", () => {
    const bullet = resolveTarget(model, targets, "li", work, rel("- 带 3 人小组完成「待补：项目名」上线"), rel("- 带 3 人小组完成「待补：项目名」上线"));
    expect(bullet).toMatchObject({ line: 10, kind: "bullet", prefix: "- ", text: "带 3 人小组完成「待补：项目名」上线", removable: true });
    const heading = resolveTarget(model, targets, "h3", work, 0, 0);
    expect(heading).toMatchObject({ line: 7, kind: "entry", prefix: "### ", text: "字节跳动 | 后端工程师 | 2021 - 至今", removable: false });
  });

  it("refuses kind mismatches and multi-line paragraphs", () => {
    expect(resolveTarget(model, targets, "p", work, 0, 0)).toBeNull();
    const edu = splitResumeSections(parseResumeContent(content).body).find((section) => (section.heading ?? section.title).includes("教育"))!.body;
    expect(resolveTarget(model, targets, "p", edu, 0, 1)).toBeNull();
    expect(resolveTarget(model, targets, "p", edu, 3, 3)).toMatchObject({ line: model.lines.indexOf("**荣誉**"), kind: "text", text: "**荣誉**" });
  });

  it("caches the alignment per source", () => {
    const cache = new Map<string, number>();
    resolveTarget(model, targets, "h3", work, 0, 0, cache);
    expect(cache.get(work)).toBe(7);
  });
});

describe("locateContext", () => {
  it("describes the section and entry of a line", () => {
    const model = parseDoc(content);
    expect(locateContext(model, 9)).toEqual({ section: "工作经历", entry: "字节跳动 | 后端工程师 | 2021 - 至今" });
    expect(locateContext(model, model.lines.indexOf("第二行说明"))).toEqual({ section: "教育" });
    expect(locateContext(model, 4)).toEqual({ section: "简历开头" });
  });
});

describe("pending helpers", () => {
  it("splits text around pending markers", () => {
    expect(splitPending("完成「待补：项目名」上线")).toEqual([
      { kind: "text", text: "完成" },
      { kind: "pending", label: "项目名", placeholder: "「待补：项目名」" },
      { kind: "text", text: "上线" },
    ]);
    expect(splitPending("「待补:」")).toEqual([{ kind: "pending", label: "待补充", placeholder: "「待补:」" }]);
  });

  it("finds the line holding a placeholder, preferring the hint", () => {
    const lines = ["a「待补：x」", "b", "c「待补：x」"];
    expect(findPendingLine(lines, "「待补：x」", 2)).toBe(2);
    expect(findPendingLine(lines, "「待补：x」", 1)).toBe(0);
    expect(findPendingLine(lines, "「待补：x」", null, 1)).toBe(2);
    expect(findPendingLine(lines, "「待补：y」", null)).toBe(-1);
  });
});

describe("ResumeMarkdown editing", () => {
  const editing: ResumeEditing = {
    remarkPlugins: [remarkPendingMarks],
    blockProps: (kind, _source, start) => ({ "data-cc-line": `${kind}:${start}` }),
    fieldProps: () => ({}),
    fieldText: (_field, value) => value,
  };

  it("renders identically without editing", () => {
    const md = "### A | B | 2020 - 2022\n\n- 一条「待补：数字」\n\n**小标题**";
    const plain = renderToStaticMarkup(<ResumeMarkdown>{md}</ResumeMarkdown>);
    expect(plain).not.toContain("data-cc");
    expect(plain).toContain("「待补：数字」");
  });

  it("adds block hooks and pending marks while keeping the themed structure", () => {
    const md = "### A | B | 2020 - 2022\n\n- 一条「待补：数字」\n\n**小标题**";
    const html = renderToStaticMarkup(<ResumeMarkdown editing={editing}>{md}</ResumeMarkdown>);
    expect(html).toContain('class="resume-entry-heading"');
    expect(html).toMatch(/<h3[^>]*data-cc-line="h3:0"/);
    expect(html).toMatch(/<li[^>]*data-cc-line="li:2"/);
    expect(html).toMatch(/<h4[^>]*data-cc-line="p:4"[^>]*class="resume-subhead"|<h4[^>]*class="resume-subhead"[^>]*data-cc-line="p:4"/);
    expect(html).toContain('data-cc-pending="「待补：数字」"');
    expect(html).toContain("待补 · 数字");
  });
});

describe("template editing hooks", () => {
  it("keeps every theme's markup unchanged when editing is absent", () => {
    for (const id of ["minimal", "editorial", "ledger", "authority", "blueprint"]) {
      const { template, themeVariables } = resolveTemplateSettings(id, {});
      const { frontmatter, body } = parseResumeContent(content);
      const html = renderToStaticMarkup(createElement(template.component, { frontmatter, body, themeVariables }));
      expect(html).not.toContain("data-cc");
    }
  });

  it("marks fields and placeholders for empty name/title in edit mode", () => {
    const { template, themeVariables } = resolveTemplateSettings("minimal", {});
    const editing: ResumeEditing = {
      remarkPlugins: [],
      blockProps: () => undefined,
      fieldProps: (field) => ({ "data-cc-field": field }),
      fieldText: (field, value) => value || `[${field}]`,
    };
    const html = renderToStaticMarkup(createElement(template.component, { frontmatter: {}, body: "", themeVariables, editing }));
    expect(html).toContain('data-cc-field="name"');
    expect(html).toContain("[name]");
    expect(html).toContain('data-cc-field="title"');
  });
});
