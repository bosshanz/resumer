import { describe, expect, it } from "vitest";
import { fitPreviewScale } from "./preview-scale";

describe("fitPreviewScale", () => {
  it("keeps the requested scale when the page fits", () => {
    expect(fitPreviewScale(794, 1000, 1)).toBe(1);
    expect(fitPreviewScale(794, 700, 0.82)).toBeCloseTo(0.82);
  });

  it("scales the page down to the available width", () => {
    expect(fitPreviewScale(794, 342, 1)).toBeCloseTo(342 / 794);
  });

  it("uses a safe scale for invalid measurements", () => {
    expect(fitPreviewScale(0, 342, 1)).toBe(1);
    expect(fitPreviewScale(794, 0, 0.82)).toBeCloseTo(0.82);
  });
});
