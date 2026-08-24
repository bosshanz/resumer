import { describe, expect, it } from "vitest";
import { buildPdfChrome, buildPdfPageCss } from "./pdf-chrome";

describe("buildPdfChrome", () => {
  it("puts escaped name, title, and page counters in the footer", () => {
    const { headerTemplate, footerTemplate } = buildPdfChrome(
      { name: "韩正 <script>", title: "AI 工程师" },
      { marginLeft: "18mm", marginRight: "16mm" }
    );

    expect(headerTemplate).not.toMatch(/pageNumber/);
    expect(footerTemplate).toContain("韩正 &lt;script&gt;");
    expect(footerTemplate).not.toContain("<script>");
    expect(footerTemplate).toContain("AI 工程师");
    expect(footerTemplate).toContain("class=\"pageNumber\"");
    expect(footerTemplate).toContain("class=\"totalPages\"");
    expect(footerTemplate).toContain("padding:0 16mm 0 18mm");
    expect(footerTemplate).toContain("background:#ffffff");
  });

  it("paints the A4 sheet with the paper color and only a footer band as page margin", () => {
    const css = buildPdfPageCss({ backgroundColor: "#faf6ed", marginBottom: "16mm" });
    expect(css).toMatch(/@page\s*\{[\s\S]*?margin:\s*0 0 16mm 0/);
    expect(css).toMatch(/@page\s*\{[\s\S]*?background:\s*#faf6ed/);
    expect(css).toMatch(/padding-bottom:\s*0\s*!important/);
    expect(css).not.toMatch(/padding-(left|right|top):\s*0\s*!important/);
  });

  it("still shows page numbers when name and title are missing", () => {
    const { footerTemplate } = buildPdfChrome({}, {});

    expect(footerTemplate).toContain("class=\"pageNumber\"");
    expect(footerTemplate).toContain("class=\"totalPages\"");
    expect(footerTemplate).not.toMatch(/·/);
  });
});
