"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { parseResumeContent } from "@/lib/parser";
import { getTemplate } from "@/lib/templates";
import { ThemeVariables } from "@/lib/types";
import {
  A4_WIDTH_MM,
  getPageGeometry,
  seamOffsetsMm,
} from "@/lib/pagination";
import { describePageFit, estimateLineHeightMm, PageFit } from "@/lib/page-fit";
import { fitPreviewScale } from "@/lib/preview-scale";

interface PreviewProps {
  content: string;
  templateId: string;
  themeVariables: ThemeVariables;
  photo?: string;
  scale?: number;
  onPageFit?: (fit: PageFit | null) => void;
}

function PageSeams({
  seams,
  width,
}: {
  seams: { top: number; page: number }[];
  width: number;
}) {
  if (seams.length === 0) return null;

  return (
    <div className="resume-preview-seams" aria-hidden="true">
      {seams.map((seam) => (
        <div key={seam.page} className="resume-preview-seam" style={{ top: seam.top, width }}>
          <span className="resume-preview-seam-tick resume-preview-seam-tick--left" />
          <span className="resume-preview-seam-rule" />
          <span className="resume-preview-seam-index">{seam.page}</span>
          <span className="resume-preview-seam-rule" />
          <span className="resume-preview-seam-tick resume-preview-seam-tick--right" />
        </div>
      ))}
    </div>
  );
}

export function Preview({ content, templateId, themeVariables, photo, scale = 1, onPageFit }: PreviewProps) {
  const { frontmatter, body, frontmatterError } = parseResumeContent(content);
  const template = getTemplate(templateId) || getTemplate("minimal")!;
  const mergedTheme = { ...template.defaultTheme, ...themeVariables };
  const themeKey = JSON.stringify(themeVariables);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [seams, setSeams] = useState<{ top: number; page: number }[]>([]);
  const [pageWidth, setPageWidth] = useState(0);
  const [renderScale, setRenderScale] = useState(scale);
  const [scaledSize, setScaledSize] = useState({ width: 0, height: 0 });
  // 上报回调走 ref：编辑器传入的 setState 是稳定的，但避免它出现在测量 effect 的依赖里
  const onPageFitRef = useRef(onPageFit);
  useEffect(() => {
    onPageFitRef.current = onPageFit;
  }, [onPageFit]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const wrap = wrapRef.current;
    const page = wrap?.querySelector(".resume-page");
    if (!viewport || !wrap || !(page instanceof HTMLElement)) {
      setSeams([]);
      onPageFitRef.current?.(null);
      return;
    }

    const geometry = getPageGeometry(
      { ...template.defaultTheme, ...themeVariables },
      template.id
    );

    const measure = () => {
      const baseWidth = page.offsetWidth;
      const nextScale = fitPreviewScale(baseWidth, viewport.clientWidth, scale);
      const pxPerMm = baseWidth / A4_WIDTH_MM;
      const paddingTop = geometry.isTech ? 0 : parseFloat(getComputedStyle(page).paddingTop) || 0;
      const paddingBottom = parseFloat(getComputedStyle(page).paddingBottom) || 0;
      const flowHeightMm = Math.max(0, (page.scrollHeight - paddingTop - paddingBottom) / pxPerMm);
      const offsets = seamOffsetsMm(flowHeightMm, geometry);
      setRenderScale(nextScale);
      setScaledSize({
        width: baseWidth * nextScale,
        height: wrap.scrollHeight * nextScale,
      });
      setPageWidth(baseWidth);
      setSeams(
        offsets.map((mm, index) => ({
          top: page.offsetTop + paddingTop + mm * pxPerMm,
          page: index + 2,
        }))
      );
      onPageFitRef.current?.(
        describePageFit({
          flowHeightMm,
          lineMm: estimateLineHeightMm({ ...template.defaultTheme, ...themeVariables }),
          geometry,
        })
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(page);

    return () => {
      observer.disconnect();
      onPageFitRef.current?.(null);
    };
  }, [content, template.id, themeKey, themeVariables, photo, scale, template.defaultTheme]);

  const Component = template.component;

  return (
    <div ref={viewportRef} className="w-full" aria-label="简历预览">
      <div
        style={{
          width: scaledSize.width || "210mm",
          height: scaledSize.height || undefined,
          margin: "0 auto",
          position: "relative",
        }}
      >
        <div
          ref={wrapRef}
          style={{
            transform: `scale(${renderScale})`,
            transformOrigin: "top left",
            width: "210mm",
            position: "relative",
          }}
        >
          {frontmatterError && (
            <div
              role="alert"
              className="mb-3 break-words rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            >
              {frontmatterError}
            </div>
          )}
          <Component frontmatter={frontmatter} body={body} themeVariables={mergedTheme} photo={photo} />
          <PageSeams seams={seams} width={pageWidth} />
        </div>
      </div>
    </div>
  );
}
