import { ThemeVariables } from "./types";

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export interface PageGeometry {
  pageHeightMm: number;
  firstContentHeightMm: number;
  nextContentHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  isTech: boolean;
}

export interface MdNode {
  type: string;
  depth?: number;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

export function parseCssLengthToMm(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === undefined || value === null || value === "") return fallback;
  const match = /^(-?[\d.]+)\s*(mm|cm|px|pt|in)?$/i.exec(String(value).trim());
  if (!match) return fallback;
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n)) return fallback;
  switch ((match[2] || "mm").toLowerCase()) {
    case "mm":
      return n;
    case "cm":
      return n * 10;
    case "in":
      return n * 25.4;
    case "pt":
      return (n * 25.4) / 72;
    case "px":
      return (n * 25.4) / 96;
    default:
      return fallback;
  }
}

export function getPageGeometry(theme: ThemeVariables, templateId: string): PageGeometry {
  const marginTopMm = parseCssLengthToMm(theme.marginTop, 16);
  const marginBottomMm = parseCssLengthToMm(theme.marginBottom, 16);
  const isTech = templateId === "tech";
  const firstTop = isTech ? 0 : marginTopMm;
  return {
    pageHeightMm: A4_HEIGHT_MM,
    firstContentHeightMm: A4_HEIGHT_MM - firstTop - marginBottomMm,
    nextContentHeightMm: A4_HEIGHT_MM - marginTopMm - marginBottomMm,
    marginTopMm,
    marginBottomMm,
    isTech,
  };
}

export function pageIndexForOffsetMm(yMm: number, geometry: PageGeometry): number {
  if (yMm < geometry.firstContentHeightMm) return 0;
  return 1 + Math.floor((yMm - geometry.firstContentHeightMm) / geometry.nextContentHeightMm);
}

export function seamOffsetsMm(contentHeightMm: number, geometry: PageGeometry): number[] {
  const seams: number[] = [];
  if (geometry.nextContentHeightMm <= 0) return seams;
  let y = geometry.firstContentHeightMm;
  while (y < contentHeightMm - 0.5) {
    seams.push(y);
    y += geometry.nextContentHeightMm;
  }
  return seams;
}

export function formatContinuationLabel(title: string): string {
  const cleaned = title.replace(/\s+/g, " ").trim();
  if (!cleaned) return "（续）";
  const parts = cleaned.split("|").map((part) => part.trim()).filter(Boolean);
  const dateLike = /(?:\d{4}|至今|present|now|current)/i;
  const kept = parts.filter((part, index) => !(index === parts.length - 1 && dateLike.test(part)));
  const base = (kept.length > 0 ? kept : parts).join(" | ");
  return /（续）\s*$/.test(base) ? base : `${base}（续）`;
}

export function wrapResumeEntryChildren(children: MdNode[]): MdNode[] {
  const next: MdNode[] = [];
  let index = 0;

  while (index < children.length) {
    const node = children[index];
    if (node.type === "heading" && node.depth === 3) {
      const group: MdNode[] = [node];
      index += 1;
      while (index < children.length) {
        const candidate = children[index];
        if (candidate.type === "heading" && (candidate.depth === 2 || candidate.depth === 3)) {
          break;
        }
        group.push(candidate);
        index += 1;
      }
      next.push({
        type: "resumeEntry",
        data: {
          hName: "article",
          hProperties: { className: "resume-entry" },
        },
        children: group,
      });
      continue;
    }
    next.push(node);
    index += 1;
  }

  return next;
}

export function remarkResumeEntries() {
  return (tree: { children?: MdNode[] }) => {
    if (!tree.children) return;
    tree.children = wrapResumeEntryChildren(tree.children);
  };
}
