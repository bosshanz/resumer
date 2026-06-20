import { ResumeFrontmatter, ThemeVariables } from "../types";
import React from "react";

export interface TemplateProps {
  frontmatter: ResumeFrontmatter;
  body: string;
  themeVariables: ThemeVariables;
  photo?: string;
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
  if (vars.textColor) style.color = vars.textColor;
  if (vars.backgroundColor) style.backgroundColor = vars.backgroundColor;
  // Expose theme as CSS custom properties so per-theme CSS can read them.
  if (vars.primaryColor) style["--resume-accent"] = vars.primaryColor;
  if (vars.secondaryColor) style["--resume-muted"] = vars.secondaryColor;
  if (vars.textColor) style["--resume-fg"] = vars.textColor;
  if (vars.backgroundColor) style["--resume-bg"] = vars.backgroundColor;
  return style;
}

export function TemplateBase({
  themeId,
  vars,
  children,
}: {
  themeId: "minimal" | "tech" | "developer";
  vars: ThemeVariables;
  children: React.ReactNode;
}) {
  return (
    <div className={`resume-page theme-${themeId}`} style={buildPageStyle(vars)}>
      {children}
    </div>
  );
}
