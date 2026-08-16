import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TemplateProps, TemplateBase, mergeThemeVariables } from "./base";
import { themedMarkdownComponents } from "./markdown";
import { splitResumeSections } from "./sections";
import { ThemeVariables } from "../types";

export const authorityDefaultTheme: ThemeVariables = {
  primaryColor: "#213b36",
  secondaryColor: "#a97828",
  backgroundColor: "#fbf8f1",
  textColor: "#202725",
  fontFamily: "var(--font-inter-tight), -apple-system, sans-serif",
  headingFontFamily: "var(--font-fraunces), Georgia, serif",
  baseFontSize: "10.5pt",
  lineHeight: 1.55,
  marginTop: "15mm",
  marginBottom: "15mm",
  marginLeft: "16mm",
  marginRight: "16mm",
};

function joinContact(c?: TemplateProps["frontmatter"]["contact"]): string[] {
  if (!c) return [];
  return [c.email, c.phone, c.github, c.website, c.linkedin, c.location].filter(
    (value): value is string => Boolean(value)
  );
}

export function AuthorityTemplate({ frontmatter, body, themeVariables, photo }: TemplateProps) {
  const vars = mergeThemeVariables(authorityDefaultTheme, themeVariables);
  const contacts = joinContact(frontmatter.contact);
  const sections = splitResumeSections(body);

  return (
    <TemplateBase themeId="authority" vars={vars}>
      <header className="resume-authority-header">
        <div className="resume-authority-identity">
          <span className="resume-authority-kicker">Quiet Authority</span>
          {frontmatter.name && <h1>{frontmatter.name}</h1>}
          {frontmatter.title && <p>{frontmatter.title}</p>}
        </div>
        {photo && (
          <figure className="resume-authority-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="resume-photo" />
          </figure>
        )}
        {contacts.length > 0 && (
          <p className="resume-authority-contact">{contacts.join("  |  ")}</p>
        )}
      </header>

      {frontmatter.summary && (
        <section className="resume-authority-lead resume-section">
          <h2>Profile</h2>
          <p>{frontmatter.summary}</p>
        </section>
      )}

      {frontmatter.skills && frontmatter.skills.length > 0 && (
        <section className="resume-authority-lead resume-section">
          <h2>Skills</h2>
          <p>{frontmatter.skills.join("  /  ")}</p>
        </section>
      )}

      <div className="resume-authority-body">
        {sections.map((section, index) => (
          <section className="resume-authority-section" key={`${section.title}-${index}`}>
            <h2>{section.title}</h2>
            <div className="resume-body resume-authority-section-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={themedMarkdownComponents}>
                {section.body}
              </ReactMarkdown>
            </div>
          </section>
        ))}
      </div>
    </TemplateBase>
  );
}
