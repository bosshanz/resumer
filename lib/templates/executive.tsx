import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ModernHeader } from "@/components/modern-header";
import { TemplateProps, TemplateBase, mergeThemeVariables } from "./base";
import { themedMarkdownComponents } from "./markdown";
import { ThemeVariables } from "../types";

export const executiveDefaultTheme: ThemeVariables = {
  primaryColor: "#173b35",
  secondaryColor: "#b68b2d",
  backgroundColor: "#fcfcfa",
  textColor: "#182421",
  fontFamily: "var(--font-inter-tight), -apple-system, sans-serif",
  headingFontFamily: "var(--font-fraunces), Georgia, serif",
  baseFontSize: "10.3pt",
  lineHeight: 1.56,
  marginTop: "20mm",
  marginBottom: "18mm",
  marginLeft: "22mm",
  marginRight: "22mm",
};

function contactRows(c?: TemplateProps["frontmatter"]["contact"]): { label: string; value: string }[] {
  if (!c) return [];
  const rows: { label: string; value: string }[] = [];
  if (c.email) rows.push({ label: "Email", value: c.email });
  if (c.phone) rows.push({ label: "Phone", value: c.phone });
  if (c.website) rows.push({ label: "Web", value: c.website });
  if (c.github) rows.push({ label: "GitHub", value: c.github });
  if (c.linkedin) rows.push({ label: "LinkedIn", value: c.linkedin });
  if (c.location) rows.push({ label: "Location", value: c.location });
  return rows;
}

export function ExecutiveTemplate({ frontmatter, body, themeVariables, photo }: TemplateProps) {
  const vars = mergeThemeVariables(executiveDefaultTheme, themeVariables);
  const rows = contactRows(frontmatter.contact);
  const useModernHeader = vars.photoLayout === "floating-monolith";

  return (
    <TemplateBase themeId="executive" vars={vars}>
      {useModernHeader && photo ? (
        <ModernHeader frontmatter={frontmatter} photo={photo} />
      ) : (
        <header className="resume-executive-header">
          <div className="resume-executive-titling">
            {frontmatter.title && <div className="resume-executive-kicker">{frontmatter.title}</div>}
            {frontmatter.name && <h1 className="resume-h1">{frontmatter.name}</h1>}
          </div>
          {photo && (
            <figure className="resume-photo-figure resume-photo-figure--executive">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="resume-photo" />
            </figure>
          )}
          {rows.length > 0 && (
            <dl className="resume-executive-contact">
              {rows.map((row) => (
                <React.Fragment key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </header>
      )}

      {frontmatter.summary && (
        <section className="resume-executive-summary resume-section">
          <span>Profile</span>
          <p>{frontmatter.summary}</p>
        </section>
      )}

      {frontmatter.skills && frontmatter.skills.length > 0 && (
        <section className="resume-executive-skills resume-section" aria-label="skills">
          <h2>Core Strengths</h2>
          <p>{frontmatter.skills.join(" / ")}</p>
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
