import { describe, expect, it } from "vitest";
import { contrastRatio, getContrastWarning } from "./color-contrast";

describe("contrastRatio", () => {
  it("calculates WCAG contrast for short and long hex colors", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 2);
    expect(contrastRatio("#ff7a45", "#fbfaf6")).toBeCloseTo(2.48, 1);
  });

  it("returns null for unsupported CSS color values", () => {
    expect(contrastRatio("var(--accent)", "#ffffff")).toBeNull();
  });
});

describe("getContrastWarning", () => {
  it("warns when a text color is below the normal-text threshold", () => {
    expect(getContrastWarning("#ff7a45", "#fbfaf6")).toMatchObject({
      level: "warning",
    });
  });

  it("accepts a color pair that meets the threshold", () => {
    expect(getContrastWarning("#111111", "#ffffff")).toMatchObject({
      level: "pass",
    });
  });
});
