import { describe, expect, it } from "vitest";
import { paginationScript } from "./paginate-dom";

// 真实分页需要浏览器排版（见 scripts/test-design-flows 与 PDF 渲染）；
// 这里只保证脚本序列化后能独立执行，不依赖模块里的其它绑定。
const run = (script: string, document: unknown) =>
  new Function("document", `"use strict"; return ${script};`)(document);

describe("paginationScript", () => {
  const geometry = { firstContentHeightMm: 256, nextContentHeightMm: 256 };

  it("is self-contained: no module bindings leak into the serialized function", () => {
    const script = paginationScript(geometry);
    expect(script).not.toMatch(/\bPAGINATION_MARK\b|\brequire\(|\bimport\b/);
    expect(script).toContain('"firstContentHeightMm":256');
  });

  it("runs in a bare page context and no-ops without a resume page", () => {
    expect(run(paginationScript(geometry), { querySelector: () => null })).toEqual({ breaks: 0, continuations: 0 });
  });

  it("removes stale markers and stops when the page has no measurable width", () => {
    const removed: string[] = [];
    const page = {
      querySelectorAll: (selector: string) => [{ remove: () => removed.push(selector) }],
      getBoundingClientRect: () => ({ width: 0, top: 0 }),
      offsetWidth: 0,
    };
    expect(run(paginationScript(geometry), { querySelector: () => page })).toEqual({ breaks: 0, continuations: 0 });
    expect(removed).toEqual(["[data-resume-pagination]"]);
  });
});
