/**
 * 预览与 PDF 共用的分页：按页高逐块测量，把跨页的块推到下一页起点，
 * 经历在页间断开时补一行「（续）」。
 *
 * 屏幕上插入的占位块用高度把内容推到下一页（预览里能看到真实的分页），
 * 打印时同一个占位块换成强制分页（高度为 0，见 base.css 的 .resume-page-break）。
 * 两边跑的是同一段代码、同一套字体，所以分页位置一致。
 *
 * 这个函数会被 PDF 导出序列化后在 Puppeteer 页面里执行：函数体只能用
 * 浏览器内置对象，不能引用模块里的其它绑定。
 */
export interface PaginationGeometry {
  firstContentHeightMm: number;
  nextContentHeightMm: number;
  /** tech 模板首页没有上边距，内容从页面顶端算起 */
  isTech?: boolean;
}

export interface PaginationResult {
  breaks: number;
  continuations: number;
}

export const PAGINATION_MARK = "data-resume-pagination";

export function paginateResumePage(page: HTMLElement, geometry: PaginationGeometry): PaginationResult {
  const MARK = "data-resume-pagination";
  // 小于这个量的越界当作测量误差，不分页
  const TOLERANCE_MM = 0.25;
  const result = { breaks: 0, continuations: 0 };

  page.querySelectorAll("[" + MARK + "]").forEach((node) => node.remove());

  const first = geometry.firstContentHeightMm;
  const next = geometry.nextContentHeightMm;
  if (!(first > 0) || !(next > 0)) return result;

  const pageRect = page.getBoundingClientRect();
  const scale = page.offsetWidth > 0 ? pageRect.width / page.offsetWidth : 1;
  const pxPerMm = pageRect.width / 210;
  if (!(pxPerMm > 0)) return result;
  const padTop = geometry.isTech ? 0 : parseFloat(getComputedStyle(page).paddingTop) || 0;
  const originPx = pageRect.top + padTop * scale;

  const toMm = (px: number) => (px - originPx) / pxPerMm;
  const pageStart = (index: number) => (index <= 0 ? 0 : first + (index - 1) * next);
  const pageHeight = (index: number) => (index <= 0 ? first : next);
  const pageIndex = (mm: number) => (mm < first ? 0 : 1 + Math.floor((mm - first) / next));

  const styleOf = (el: Element) => getComputedStyle(el);
  // 并排排布的盒子（横向 flex、多列 grid、表格）里不能插占位块；
  // 纵向堆叠的 flex / 单列 grid 和普通块流一样，可以在子项之间换页。
  const isLayoutBox = (el: Element) => {
    const style = styleOf(el);
    const display = style.display;
    if (/table/.test(display)) return true;
    if (/flex/.test(display)) return !/column/.test(style.flexDirection);
    if (/grid/.test(display)) return style.gridTemplateColumns.trim().split(/\s+/).length > 1;
    return false;
  };
  const isMark = (el: Element) => el.hasAttribute(MARK);
  const inFlow = (el: Element) => {
    if (isMark(el)) return false;
    const style = styleOf(el);
    if (style.display === "none" || style.display === "contents") return false;
    return style.position !== "absolute" && style.position !== "fixed";
  };
  const avoids = (value: string) => value === "avoid" || value === "avoid-page";

  const previousInFlow = (el: Element) => {
    let prev = el.previousElementSibling;
    while (prev && !inFlow(prev)) prev = prev.previousElementSibling;
    return prev;
  };

  // 往上找到「前面还有兄弟块」的那一层；碰到 flex/grid 父级就停，那里不能插占位块
  const precedingSibling = (el: Element): Element | null => {
    let node: Element = el;
    while (node !== page) {
      const prev = previousInFlow(node);
      if (prev) return prev;
      const parent = node.parentElement;
      if (!parent || parent === page || isLayoutBox(parent)) return null;
      node = parent;
    }
    return null;
  };

  // el 是不是 ancestor 里的第一块（前面没有兄弟内容）
  const startsWithin = (el: Element, ancestor: Element) => {
    let node: Element = el;
    while (node !== ancestor) {
      if (previousInFlow(node)) return false;
      const parent = node.parentElement;
      if (!parent) return true;
      node = parent;
    }
    return true;
  };

  // 经历只剩标题行（h3 / 紧跟的说明段）留在上一页时，整条经历一起换页
  const onlyHeadingBefore = (el: Element, entry: Element) => {
    let node: Element = el;
    while (node.parentElement && node.parentElement !== entry) node = node.parentElement;
    if (node.parentElement !== entry || !startsWithin(el, node)) return false;
    if (entry.getBoundingClientRect().height / pxPerMm > next - TOLERANCE_MM) return false;
    let prev = previousInFlow(node);
    if (!prev) return false;
    while (prev) {
      if (!/^(H3|H4|P)$/.test(prev.tagName)) return false;
      prev = previousInFlow(prev);
    }
    return true;
  };

  const resolveTarget = (el: Element): Element | null => {
    let target: Element = el;
    for (let guard = 0; guard < 40; guard += 1) {
      const parent = target.parentElement;
      if (!parent) return null;
      if (parent !== page && isLayoutBox(parent)) {
        target = parent;
        continue;
      }
      const entry = target.closest(".resume-entry");
      if (entry && entry !== target && page.contains(entry) && onlyHeadingBefore(target, entry)) {
        target = entry;
        continue;
      }
      const prev = precedingSibling(target);
      if (prev && (avoids(styleOf(prev).breakAfter) || avoids(styleOf(target).breakBefore))) {
        target = prev;
        continue;
      }
      return target;
    }
    return target;
  };

  const continuationLabel = (entry: Element) => {
    const identity = entry.querySelector(".resume-entry-identity");
    if (identity && identity.textContent && identity.textContent.trim()) {
      return identity.textContent.replace(/\s+/g, " ").trim() + "（续）";
    }
    const heading = entry.querySelector("h3");
    const cleaned = ((heading && heading.textContent) || "").replace(/\s+/g, " ").trim();
    if (!cleaned) return "（续）";
    const parts = cleaned.split(/[|｜]/).map((part) => part.trim()).filter(Boolean);
    const dateLike = /(?:\d{4}|至今|present|now|current)/i;
    const kept = parts.filter((part, index) => !(index === parts.length - 1 && dateLike.test(part)));
    return (kept.length > 0 ? kept : parts).join(" | ") + "（续）";
  };

  const breakBefore = (atom: Element) => {
    const target = resolveTarget(atom);
    if (!target || target === page || !target.parentElement) return;
    const top = toMm(target.getBoundingClientRect().top);
    const index = pageIndex(top);
    // 已经在页首：再推只会多出一张空页
    if (top <= pageStart(index) + TOLERANCE_MM) return;
    const boundary = pageStart(index + 1);

    const parent = target.parentElement;
    const listParent = parent.tagName === "UL" || parent.tagName === "OL";
    const spacer = document.createElement(listParent ? "li" : "div");
    spacer.setAttribute(MARK, "break");
    spacer.setAttribute("aria-hidden", "true");
    spacer.className = "resume-page-break";
    spacer.style.height = "1px";
    parent.insertBefore(spacer, target);
    const spacerTop = toMm(spacer.getBoundingClientRect().top);
    spacer.style.height = Math.max(0, boundary - spacerTop).toFixed(3) + "mm";
    result.breaks += 1;

    const entry = target.closest(".resume-entry");
    if (entry && entry !== target && !startsWithin(target, entry)) {
      const label = document.createElement(listParent ? "li" : "p");
      label.setAttribute(MARK, "continue");
      label.className = "resume-continue";
      label.textContent = continuationLabel(entry);
      // 列表里的续标和经历标题对齐，而不是缩进到项目符号后面
      if (listParent) label.style.marginLeft = "-" + styleOf(parent).paddingLeft;
      parent.insertBefore(label, target);
      result.continuations += 1;
    }
  };

  const isContainer = (el: Element, style: CSSStyleDeclaration) => {
    if (avoids(style.breakInside)) return false;
    if (/^(P|H1|H2|H3|H4|H5|H6|LI|TR|IMG|FIGURE|svg)$/i.test(el.tagName)) return false;
    return Array.from(el.children).some((child) => inFlow(child) && !/^inline/.test(styleOf(child).display));
  };

  const visit = (el: Element) => {
    if (!inFlow(el)) return;
    const style = styleOf(el);
    if (isContainer(el, style)) {
      Array.from(el.children).forEach(visit);
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) return;
    const top = toMm(rect.top);
    const bottom = toMm(rect.bottom);
    const index = pageIndex(top + TOLERANCE_MM);
    if (bottom <= pageStart(index + 1) + TOLERANCE_MM) return;
    // 比整页还高的块推不过去，交给浏览器自然断开
    if (bottom - top > pageHeight(index + 1) - TOLERANCE_MM) return;
    breakBefore(el);
  };

  Array.from(page.children).forEach(visit);
  return result;
}

/**
 * 给 Puppeteer 用的脚本：序列化后在页面里执行。tsx/esbuild 可能给函数加
 * __name 包装，这里补一个空实现。
 */
export function paginationScript(geometry: PaginationGeometry): string {
  return `(() => {
  var __name = function (fn) { return fn; };
  var page = document.querySelector(".resume-page");
  if (!page) return { breaks: 0, continuations: 0 };
  return (${paginateResumePage.toString()})(page, ${JSON.stringify(geometry)});
})()`;
}
