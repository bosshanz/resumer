import { ResumeFrontmatter, ThemeVariables } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function pageSurfaceColor(theme: ThemeVariables): string {
  return theme.backgroundColor || "#ffffff";
}

export function buildPdfPageCss(theme: ThemeVariables): string {
  const bg = pageSurfaceColor(theme);
  const footerBand = theme.marginBottom || "16mm";
  return `
    @page {
      size: A4;
      margin: 0 0 ${footerBand} 0;
      background: ${bg};
    }
    html, body {
      margin: 0;
      background: ${bg};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .resume-page {
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
    }
    @media print {
      .resume-page {
        padding-bottom: 0 !important;
      }
    }
  `;
}

export function buildPdfChrome(
  frontmatter: Pick<ResumeFrontmatter, "name" | "title">,
  theme: ThemeVariables
): { headerTemplate: string; footerTemplate: string } {
  const name = escapeHtml((frontmatter.name || "").trim());
  const title = escapeHtml((frontmatter.title || "").trim());
  const identity = [name, title].filter(Boolean).join(" · ");
  const padL = theme.marginLeft || "20mm";
  const padR = theme.marginRight || "20mm";
  const bg = pageSurfaceColor(theme);

  // Zero-height header so first-page bleeds are not covered. Background still
  // paints any reserved header strip the same color as the paper.
  const headerTemplate = `<div style="font-size:0;height:0;margin:0;padding:0;line-height:0;width:100%;background:${bg};"></div>`;

  const footerTemplate = `<div style="width:100%;box-sizing:border-box;padding:0 ${padR} 0 ${padL};font-size:8px;line-height:1.2;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Noto Sans SC',sans-serif;display:flex;justify-content:space-between;align-items:center;border-top:0.4px solid #d4d4d8;padding-top:3px;background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact;">
    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:78%;">${identity}</span>
    <span style="flex-shrink:0;letter-spacing:0.04em;"><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;

  return { headerTemplate, footerTemplate };
}
