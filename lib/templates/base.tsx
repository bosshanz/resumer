import { ResumeFrontmatter, ThemeVariables } from "../types";
import React from "react";
import type { ResumeEditing } from "./editing";

export interface TemplateProps {
  frontmatter: ResumeFrontmatter;
  body: string;
  themeVariables: ThemeVariables;
  photo?: string;
  /** 仅 AI 共创的可编辑稿面使用；预览与 PDF 不传 */
  editing?: ResumeEditing;
}

export function mergeThemeVariables(
  templateDefaults: ThemeVariables,
  overrides: ThemeVariables
): ThemeVariables {
  return { ...templateDefaults, ...overrides };
}

export function buildPageStyle(vars: ThemeVariables): React.CSSProperties {
  const style: React.CSSProperties & Record<string, string | number | undefined> = {
    fontSize: vars.baseFontSize || "10.5pt",
    lineHeight: vars.lineHeight || 1.6,
    paddingTop: vars.marginTop || "16mm",
    paddingBottom: vars.marginBottom || "16mm",
    paddingLeft: vars.marginLeft || "20mm",
    paddingRight: vars.marginRight || "20mm",
  };
  if (vars.fontFamily) style.fontFamily = vars.fontFamily;
  if (vars.headingFontFamily) style["--resume-heading-font"] = vars.headingFontFamily;
  if (vars.textColor) style.color = vars.textColor;
  if (vars.backgroundColor) style.backgroundColor = vars.backgroundColor;
  // Expose theme as CSS custom properties so per-theme CSS can read them.
  if (vars.primaryColor) style["--resume-accent"] = vars.primaryColor;
  if (vars.secondaryColor) style["--resume-muted"] = vars.secondaryColor;
  if (vars.textColor) style["--resume-fg"] = vars.textColor;
  if (vars.backgroundColor) style["--resume-bg"] = vars.backgroundColor;
  style["--resume-pad-top"] = vars.marginTop || "16mm";
  style["--resume-pad-bottom"] = vars.marginBottom || "16mm";
  style["--resume-pad-left"] = vars.marginLeft || "20mm";
  style["--resume-pad-right"] = vars.marginRight || "20mm";
  return style;
}

export function TemplateBase({
  themeId,
  vars,
  children,
  language,
}: {
  themeId:
    | "minimal"
    | "tech"
    | "developer"
    | "grid"
    | "editorial"
    | "executive"
    | "compact"
    | "ledger"
    | "authority"
    | "blueprint";
  vars: ThemeVariables;
  language?: "zh-CN" | "en";
  children: React.ReactNode;
}) {
  return (
    <div className={`resume-page theme-${themeId}`} style={buildPageStyle(vars)} lang={language}>
      {children}
    </div>
  );
}
