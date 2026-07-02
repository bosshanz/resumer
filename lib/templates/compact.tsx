import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ModernHeader } from "@/components/modern-header";
import { TemplateProps, TemplateBase, mergeThemeVariables } from "./base";
import { themedMarkdownComponents } from "./markdown";
import { ThemeVariables } from "../types";

export const compactDefaultTheme: ThemeVariables = {
  primaryColor: "#111827",
  secondaryColor: "#2563eb",
  backgroundColor: "#ffffff",
  textColor: "#111827",
  fontFamily: "var(--font-geist-sans), -apple-system, sans-serif",
  headingFontFamily: "var(--font-geist-sans), sans-serif",
  baseFontSize: "9.6pt",
  lineHeight: 1.42,
  marginTop: "14mm",
  marginBottom: "14mm",
  marginLeft: "16mm",
  marginRight: "16mm",
};

function joinContact(c?: TemplateProps["frontmatter"]["contact"]): string[] {
  if (!c) return [];
  const parts: string[] = [];
  if (c.email) parts.push(c.email);
  if (c.phone) parts.push(c.phone);
  if (c.github) parts.push(c.github);
  if (c.website) parts.push(c.website);
  if (c.linkedin) parts.push(c.linkedin);
  if (c.location) parts.push(c.location);
  return parts;
}

export function CompactTemplate({ frontmatter, body, themeVariables, photo }: TemplateProps) {
  const vars = mergeThemeVariables(compactDefaultTheme, themeVariables);
  const contactParts = joinContact(frontmatter.contact);
  const useModernHeader = vars.photoLayout === "floating-monolith";

  return (
    <TemplateBase themeId="compact" vars={vars}>
      {useModernHeader && photo ? (
        <ModernHeader frontmatter={frontmatter} photo={photo} />
      ) : (
        <header className="resume-compact-header">
          <div className="resume-compact-identity">
            {frontmatter.name && <h1 className="resume-h1">{frontmatter.name}</h1>}
            {frontmatter.title && <div className="resume-compact-title">{frontmatter.title}</div>}
            {contactParts.length > 0 && <p className="resume-compact-contact">{contactParts.join(" | ")}</p>}
          </div>
          {photo && (
            <figure className="resume-photo-figure resume-photo-figure--compact">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="resume-photo" />
            </figure>
          )}
        </header>
      )}

      {(frontmatter.summary || (frontmatter.skills && frontmatter.skills.length > 0)) && (
        <section className="resume-compact-overview resume-section">
          {frontmatter.summary && (
            <div className="resume-compact-summary">
              <h2>Summary</h2>
              <p>{frontmatter.summary}</p>
            </div>
          )}
          {frontmatter.skills && frontmatter.skills.length > 0 && (
            <div className="resume-compact-skills">
              <h2>Skills</h2>
              <p>{frontmatter.skills.join(" / ")}</p>
            </div>
          )}
        </section>
      )}

      <section className="resume-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={themedMarkdownComponents}>
          {body}
        </ReactMarkdown>
      </section>
    </TemplateBase>
  );
}
