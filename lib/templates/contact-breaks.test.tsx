import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { breakableContact, breakableRole } from "./folio";

const render = (value: string) => renderToStaticMarkup(<>{breakableContact(value)}</>);
const text = (html: string) => html.replace(/<[^>]+>/g, "");

describe("contact line breaking", () => {
  it("only offers breaks after URL separators, never at hyphens", () => {
    const html = render("github.com/yuan-chen-demo");
    expect(text(html)).toBe("github.com/yuan-chen-demo");
    expect(html).toContain('<span class="folio-nobreak">yuan-chen-demo</span>');
    expect(html.split("<wbr/>")).toHaveLength(3);
    expect(html).not.toMatch(/-<wbr\/>/);
  });

  it("keeps emails intact text and splits after @ and dots", () => {
    const html = render("yuan.chen@example.com");
    expect(text(html)).toBe("yuan.chen@example.com");
    expect(html).toContain("<wbr/>");
  });

  it("leaves phones, places and prose untouched", () => {
    expect(render("139 0000 2468")).toBe("139 0000 2468");
    expect(render("上海")).toBe("上海");
  });

  it("lets very long segments wrap instead of overflowing a narrow rail", () => {
    const html = render("example.com/an-extremely-long-handle-that-cannot-fit");
    expect(html).toContain("an-extremely-long-handle-that-cannot-fit");
    expect(html).not.toContain('<span class="folio-nobreak">an-extremely');
  });
});

describe("role phrase breaking", () => {
  const renderRole = (value: string) => renderToStaticMarkup(<>{breakableRole(value)}</>);

  it("wraps whole phrases at the · separator and keeps the visible text", () => {
    const html = renderRole("AI Agent 工程师 · LLM 应用与平台");
    expect(text(html)).toBe("AI Agent 工程师 · LLM 应用与平台");
    expect(html).toContain('<span class="folio-phrase">AI Agent 工程师 ·</span>');
    expect(html).toContain('<span class="folio-phrase">LLM 应用与平台</span>');
  });

  it("leaves single-phrase roles as plain text", () => {
    expect(renderRole("高级前端工程师")).toBe("高级前端工程师");
    expect(renderRole("UI/UX Designer")).toBe("UI/UX Designer");
  });
});
