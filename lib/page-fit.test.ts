import { describe, expect, it } from "vitest";
import { describePageFit, estimateLineHeightMm, SLIGHT_OVERFLOW_MAX_LINES } from "./page-fit";
import { getPageGeometry } from "./pagination";

const geometry = getPageGeometry({}, "minimal"); // 16mm 上下边距 → 首页 265mm
const lineMm = 6;

describe("estimateLineHeightMm", () => {
  it("默认主题回退到 10.5pt × 1.6", () => {
    const expected = ((10.5 * 25.4) / 72) * 1.6;
    expect(estimateLineHeightMm({})).toBeCloseTo(expected, 5);
  });

  it("支持数字与字符串行高、pt/px 字号", () => {
    const pt = estimateLineHeightMm({ baseFontSize: "10.5pt", lineHeight: 1.8 });
    expect(pt).toBeCloseTo(((10.5 * 25.4) / 72) * 1.8, 5);

    const px = estimateLineHeightMm({ baseFontSize: "14px", lineHeight: "1.5" });
    expect(px).toBeCloseTo(((14 * 25.4) / 96) * 1.5, 5);
  });

  it("非法值回退并被钳制在合理区间", () => {
    const garbage = estimateLineHeightMm({ baseFontSize: "nonsense", lineHeight: "abc" });
    expect(garbage).toBeCloseTo(((10.5 * 25.4) / 72) * 1.6, 5);
    expect(estimateLineHeightMm({ lineHeight: 99 })).toBeCloseTo(((10.5 * 25.4) / 72) * 3, 5);
  });
});

describe("describePageFit", () => {
  it("单页且余量充足时提示还能放几行", () => {
    const fit = describePageFit({ flowHeightMm: 200, lineMm, geometry });
    expect(fit.status).toBe("spacious");
    expect(fit.pageCount).toBe(1);
    expect(fit.remainingLines).toBe(10); // (265 - 200) / 6 = 10.8 → 10
    expect(fit.label).toBe("1 页 · 还能放约 10 行");
  });

  it("单页接近满页时不再给行数", () => {
    const fit = describePageFit({ flowHeightMm: 264, lineMm, geometry });
    expect(fit.status).toBe("near-full");
    expect(fit.label).toBe("1 页 · 接近满页");
  });

  it("恰好压线时余量不为负", () => {
    const fit = describePageFit({ flowHeightMm: 265.2, lineMm, geometry });
    expect(fit.status).toBe("near-full");
    expect(fit.remainingLines).toBe(0);
  });

  it("第 2 页行数很少时点名溢出行数", () => {
    const fit = describePageFit({ flowHeightMm: 271, lineMm, geometry });
    // 首页 265mm，第 2 页 6mm = 1 行
    expect(fit.pageCount).toBe(2);
    expect(fit.status).toBe("slight-overflow");
    expect(fit.overflowLines).toBe(1);
    expect(fit.label).toBe("2 页 · 第 2 页仅 1 行");
  });

  it("第 2 页行数超过阈值时只报页数", () => {
    const flow = geometry.firstContentHeightMm + SLIGHT_OVERFLOW_MAX_LINES * lineMm + lineMm;
    const fit = describePageFit({ flowHeightMm: flow, lineMm, geometry });
    expect(fit.pageCount).toBe(2);
    expect(fit.status).toBe("multi-page");
    expect(fit.label).toBe("2 页");
  });

  it("三页及以上只报页数", () => {
    const fit = describePageFit({ flowHeightMm: 600, lineMm, geometry });
    expect(fit.pageCount).toBe(3);
    expect(fit.status).toBe("multi-page");
    expect(fit.label).toBe("3 页");
  });

  it("tech 模板首页没有上边距，容量按其几何计算", () => {
    const techGeometry = getPageGeometry({}, "tech");
    expect(techGeometry.firstContentHeightMm).toBe(297 - 16); // 只有下边距
    const fit = describePageFit({ flowHeightMm: 280, lineMm, geometry: techGeometry });
    expect(fit.status).toBe("near-full");
  });
});
