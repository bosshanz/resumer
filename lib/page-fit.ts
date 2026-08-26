import { PageGeometry, parseCssLengthToMm, seamOffsetsMm } from "./pagination";
import { ThemeVariables } from "./types";

export type PageFitStatus = "spacious" | "near-full" | "slight-overflow" | "multi-page";

export interface PageFit {
  pageCount: number;
  status: PageFitStatus;
  /** 单页时：满页前还能放下几行 */
  remainingLines?: number;
  /** 两页且溢出很少时：第 2 页上有几行 */
  overflowLines?: number;
  label: string;
}

// 第 2 页只有这几行以内时，值得提示「差一点就能收进一页」
export const SLIGHT_OVERFLOW_MAX_LINES = 8;
export const NEAR_FULL_MAX_LINES = 2;

const DEFAULT_FONT_SIZE_MM = (10.5 * 25.4) / 72;
const DEFAULT_LINE_HEIGHT = 1.6;

export function estimateLineHeightMm(theme: ThemeVariables): number {
  const fontSizeMm = parseCssLengthToMm(theme.baseFontSize, DEFAULT_FONT_SIZE_MM);
  let multiplier = DEFAULT_LINE_HEIGHT;
  if (typeof theme.lineHeight === "number" && Number.isFinite(theme.lineHeight)) {
    multiplier = theme.lineHeight;
  } else if (typeof theme.lineHeight === "string") {
    const parsed = parseFloat(theme.lineHeight);
    if (Number.isFinite(parsed)) multiplier = parsed;
  }
  const safeMultiplier = Math.min(3, Math.max(0.8, multiplier));
  return Math.max(1, fontSizeMm * safeMultiplier);
}

export function describePageFit(input: {
  flowHeightMm: number;
  lineMm: number;
  geometry: PageGeometry;
}): PageFit {
  const { flowHeightMm, lineMm, geometry } = input;
  const safeLineMm = Math.max(1, lineMm);
  const seams = seamOffsetsMm(flowHeightMm, geometry);
  const pageCount = seams.length + 1;

  if (pageCount === 1) {
    const remainingLines = Math.max(
      0,
      Math.floor((geometry.firstContentHeightMm - flowHeightMm) / safeLineMm)
    );
    if (remainingLines <= NEAR_FULL_MAX_LINES) {
      return { pageCount, status: "near-full", remainingLines, label: "1 页 · 接近满页" };
    }
    return {
      pageCount,
      status: "spacious",
      remainingLines,
      label: `1 页 · 还能放约 ${remainingLines} 行`,
    };
  }

  const lastSeamMm = seams[seams.length - 1];
  const lastPageLines = Math.max(1, Math.ceil((flowHeightMm - lastSeamMm) / safeLineMm));

  if (pageCount === 2 && lastPageLines <= SLIGHT_OVERFLOW_MAX_LINES) {
    return {
      pageCount,
      status: "slight-overflow",
      overflowLines: lastPageLines,
      label: `2 页 · 第 2 页仅 ${lastPageLines} 行`,
    };
  }

  return { pageCount, status: "multi-page", label: `${pageCount} 页` };
}
