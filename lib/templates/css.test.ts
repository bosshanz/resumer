import { describe, expect, it } from "vitest";
import { readResumeTemplateCss } from "./css";

function ruleBody(css: string, selectorPattern: RegExp): string {
  const match = selectorPattern.exec(css);
  if (!match) {
    throw new Error(`No CSS rule matching ${selectorPattern}`);
  }
  return match[1];
}

describe("resume template CSS", () => {
  it("does not grayscale theme photos", () => {
    const css = readResumeTemplateCss();

    expect(css).not.toMatch(/grayscale\s*\(/i);
  });

  it("lets lists split between items, not through an item or after a heading", () => {
    const css = readResumeTemplateCss();

    const listRule = ruleBody(
      css,
      /\.resume-body ul,\s*\.resume-body ol\s*\{([^}]+)\}/
    );
    expect(listRule).not.toMatch(/break-inside:\s*avoid/);
    expect(listRule).not.toMatch(/page-break-inside:\s*avoid/);

    const itemRule = ruleBody(css, /\.resume-body li\s*\{([^}]+)\}/);
    expect(itemRule).toMatch(/break-inside:\s*avoid/);

    const headingRule = ruleBody(
      css,
      /\.resume-body h1,\s*\.resume-body h2,\s*\.resume-body h3,\s*\.resume-body h4\s*\{([^}]+)\}/
    );
    expect(headingRule).toMatch(/break-after:\s*avoid/);

    const introRule = ruleBody(css, /\.resume-body h3 \+ p\s*\{([^}]+)\}/);
    expect(introRule).toMatch(/break-inside:\s*avoid/);
    expect(introRule).toMatch(/break-after:\s*avoid/);
  });
});
