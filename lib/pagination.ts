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

export interface PlannedBlock {
  topMm: number;
  bottomMm: number;
  role: "heading" | "block" | "list";
  items?: { topMm: number; bottomMm: number }[];
}

export interface PlannedEntry {
  title: string;
  blocks: PlannedBlock[];
}

export interface ContinuationPlan {
  entryIndex: number;
  label: string;
  block: number;
  item?: number;
  page: number;
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

export function planContinuations(entries: PlannedEntry[], geometry: PageGeometry): ContinuationPlan[] {
  const plans: ContinuationPlan[] = [];

  entries.forEach((entry, entryIndex) => {
    const heading = entry.blocks.find((block) => block.role === "heading") ?? entry.blocks[0];
    if (!heading) return;
    let lastPage = pageIndexForOffsetMm(heading.topMm, geometry);
    const label = formatContinuationLabel(entry.title);

    entry.blocks.forEach((block, blockIndex) => {
      if (block.role === "heading") return;

      const page = pageIndexForOffsetMm(block.topMm, geometry);
      if (page > lastPage) {
        plans.push({ entryIndex, label, block: blockIndex, page });
        lastPage = page;
      }
    });
  });

  return plans;
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

export type ContinuationGeometry = {
  firstContentHeightMm: number;
  nextContentHeightMm: number;
  isTech: boolean;
};

/** Plain JS so Puppeteer/tsx cannot wrap it with a helper the browser does not have. */
export const injectContinuationsSource = `"use strict";
var page = document.querySelector(".resume-page");
if (!page) return 0;
page.querySelectorAll(".resume-continue").forEach(function (node) { node.remove(); });
function formatLabel(title) {
  var cleaned = String(title || "").replace(/\\s+/g, " ").trim();
  if (!cleaned) return "（续）";
  var parts = cleaned.split("|").map(function (part) { return part.trim(); }).filter(Boolean);
  var dateLike = /(?:\\d{4}|至今|present|now|current)/i;
  var kept = parts.filter(function (part, index) {
    return !(index === parts.length - 1 && dateLike.test(part));
  });
  var base = (kept.length > 0 ? kept : parts).join(" | ");
  return /（续）\\s*$/.test(base) ? base : base + "（续）";
}
function pageIndex(yMm) {
  if (yMm < geometry.firstContentHeightMm) return 0;
  return 1 + Math.floor((yMm - geometry.firstContentHeightMm) / geometry.nextContentHeightMm);
}
var pageRect = page.getBoundingClientRect();
var pxPerMm = pageRect.width / 210;
if (pxPerMm <= 0) return 0;
var paddingTop = geometry.isTech ? 0 : parseFloat(getComputedStyle(page).paddingTop) || 0;
var originTop = pageRect.top + paddingTop;
function offsetMm(el) {
  return (el.getBoundingClientRect().top - originTop) / pxPerMm;
}
function createMark(label, tagName) {
  var mark = document.createElement(tagName);
  mark.className = "resume-continue";
  mark.setAttribute("data-resume-continue", "true");
  mark.textContent = label;
  return mark;
}
var inserted = 0;
page.querySelectorAll(".resume-entry").forEach(function (entry) {
  var heading = entry.querySelector("h3");
  if (!heading) return;
  var label = formatLabel(heading.textContent || "");
  var lastPage = pageIndex(offsetMm(heading));
  Array.from(entry.children).forEach(function (block) {
    if (block.classList.contains("resume-continue")) return;
    if (block === heading || block.contains(heading)) return;
    var pageNo = pageIndex(offsetMm(block));
    if (pageNo > lastPage) {
      block.before(createMark(label, "p"));
      lastPage = pageNo;
      inserted += 1;
    }
  });
});
return inserted;
`;

export function injectContinuationsInDocument(geometry: ContinuationGeometry): number {
  const page = document.querySelector(".resume-page");
  if (!page) return 0;

  page.querySelectorAll(".resume-continue").forEach((node) => node.remove());

  function formatLabel(title: string): string {
    return formatContinuationLabel(title);
  }

  function pageIndex(yMm: number): number {
    return pageIndexForOffsetMm(yMm, {
      pageHeightMm: 297,
      firstContentHeightMm: geometry.firstContentHeightMm,
      nextContentHeightMm: geometry.nextContentHeightMm,
      marginTopMm: 0,
      marginBottomMm: 0,
      isTech: geometry.isTech,
    });
  }

  const pageRect = page.getBoundingClientRect();
  const pxPerMm = pageRect.width / 210;
  if (pxPerMm <= 0) return 0;
  const paddingTop = geometry.isTech ? 0 : parseFloat(getComputedStyle(page).paddingTop) || 0;
  const originTop = pageRect.top + paddingTop;

  function offsetMm(el: Element): number {
    return (el.getBoundingClientRect().top - originTop) / pxPerMm;
  }

  function createMark(label: string, tagName: "p" | "li"): HTMLElement {
    const mark = document.createElement(tagName);
    mark.className = "resume-continue";
    mark.setAttribute("data-resume-continue", "true");
    mark.textContent = label;
    return mark;
  }

  let inserted = 0;
  page.querySelectorAll<HTMLElement>(".resume-entry").forEach((entry) => {
    const heading = entry.querySelector("h3");
    if (!heading) return;
    const label = formatLabel(heading.textContent || "");
    let lastPage = pageIndex(offsetMm(heading));

    Array.from(entry.children).forEach((block) => {
      if (block.classList.contains("resume-continue")) return;
      if (block === heading || block.contains(heading)) return;

      const pageNo = pageIndex(offsetMm(block));
      if (pageNo > lastPage) {
        block.before(createMark(label, "p"));
        lastPage = pageNo;
        inserted += 1;
      }
    });
  });

  return inserted;
}
