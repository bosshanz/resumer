import { describe, expect, it } from "vitest";
import {
  formatContinuationLabel,
  getPageGeometry,
  pageIndexForOffsetMm,
  parseCssLengthToMm,
  seamOffsetsMm,
  wrapResumeEntryChildren,
} from "./pagination";

describe("parseCssLengthToMm", () => {
  it("reads mm and common CSS units", () => {
    expect(parseCssLengthToMm("16mm", 0)).toBe(16);
    expect(parseCssLengthToMm("2cm", 0)).toBe(20);
    expect(parseCssLengthToMm("96px", 0)).toBeCloseTo(25.4);
    expect(parseCssLengthToMm(undefined, 14)).toBe(14);
  });
});

describe("page geometry", () => {
  it("gives tech a taller first page because @page:first has no top margin", () => {
    const tech = getPageGeometry(
      { marginTop: "16mm", marginBottom: "16mm" },
      "tech"
    );
    const minimal = getPageGeometry(
      { marginTop: "22mm", marginBottom: "22mm" },
      "minimal"
    );

    expect(tech.firstContentHeightMm).toBe(297 - 16);
    expect(tech.nextContentHeightMm).toBe(297 - 16 - 16);
    expect(minimal.firstContentHeightMm).toBe(297 - 22 - 22);
    expect(pageIndexForOffsetMm(0, tech)).toBe(0);
    expect(pageIndexForOffsetMm(tech.firstContentHeightMm, tech)).toBe(1);
  });

  it("places a seam at the start of every page after the first", () => {
    const geo = getPageGeometry({ marginTop: "16mm", marginBottom: "16mm" }, "minimal");
    expect(seamOffsetsMm(geo.firstContentHeightMm + geo.nextContentHeightMm * 2.2, geo)).toEqual([
      geo.firstContentHeightMm,
      geo.firstContentHeightMm + geo.nextContentHeightMm,
      geo.firstContentHeightMm + geo.nextContentHeightMm * 2,
    ]);
    expect(seamOffsetsMm(geo.firstContentHeightMm - 1, geo)).toEqual([]);
  });
});

describe("formatContinuationLabel", () => {
  it("keeps company and role, drops the date, and appends 续", () => {
    expect(
      formatContinuationLabel("上海引态科技有限公司 | AI 全栈工程师 | 2025.08 - 2026.03")
    ).toBe("上海引态科技有限公司 | AI 全栈工程师（续）");
  });

  it("is idempotent and handles a bare title", () => {
    expect(formatContinuationLabel("独立开发者")).toBe("独立开发者（续）");
    expect(formatContinuationLabel("独立开发者（续）")).toBe("独立开发者（续）");
    expect(formatContinuationLabel("   ")).toBe("（续）");
  });
});

describe("wrapResumeEntryChildren", () => {
  it("wraps each ### group until the next heading of depth 2 or 3", () => {
    const tree = wrapResumeEntryChildren([
      { type: "heading", depth: 2 },
      { type: "heading", depth: 3 },
      { type: "list" },
      { type: "heading", depth: 3 },
      { type: "paragraph" },
      { type: "heading", depth: 2 },
    ]);

    expect(tree.map((n) => n.type)).toEqual(["heading", "resumeEntry", "resumeEntry", "heading"]);
    expect(tree[1].children?.map((n) => n.type)).toEqual(["heading", "list"]);
    expect(tree[1].data?.hName).toBe("article");
    expect(tree[1].data?.hProperties).toMatchObject({ className: "resume-entry" });
  });
});
