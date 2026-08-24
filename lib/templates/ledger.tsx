import React from "react";
import { TemplateProps, TemplateBase, mergeThemeVariables } from "./base";
import { ResumeMarkdown } from "./resume-markdown";
import { hasSkills, ResumeSkills } from "./resume-skills";
import { splitResumeSections } from "./sections";
import { ThemeVariables } from "../types";

export const ledgerDefaultTheme: ThemeVariables = {
  primaryColor: "#d42c24",
  secondaryColor: "#687078",
  backgroundColor: "#ffffff",
  textColor: "#111214",
  fontFamily: "var(--font-plex-sans), -apple-system, sans-serif",
  headingFontFamily: "var(--font-inter-tight), -apple-system, sans-serif",
  baseFontSize: "9.8pt",
  lineHeight: 1.48,
  marginTop: "14mm",
  marginBottom: "14mm",
  marginLeft: "14mm",
  marginRight: "14mm",
};

function contactRows(c?: TemplateProps["frontmatter"]["contact"]) {
  if (!c) return [];
  return [
    ["EMAIL", c.email],
    ["TEL", c.phone],
    ["GITHUB", c.github],
    ["WEB", c.website],
    ["LINKEDIN", c.linkedin],
    ["LOCATION", c.location],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

export function LedgerTemplate({ frontmatter, body, themeVariables, photo }: TemplateProps) {
  const vars = mergeThemeVariables(ledgerDefaultTheme, themeVariables);
  const contacts = contactRows(frontmatter.contact);
  const sections = splitResumeSections(body);

  return (
    <TemplateBase themeId="ledger" vars={vars}>
      <header className="resume-ledger-header">
        <div className="resume-ledger-identity">
          {frontmatter.title && <p className="resume-ledger-role">{frontmatter.title}</p>}
          {frontmatter.name && <h1>{frontmatter.name}</h1>}
        </div>
        {contacts.length > 0 && (
          <dl className="resume-ledger-contact">
            {contacts.map(([label, value]) => (
              <React.Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </React.Fragment>
            ))}
          </dl>
        )}
        {photo && (
          <figure className="resume-ledger-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="resume-photo" />
          </figure>
        )}
      </header>

      {frontmatter.summary && <p className="resume-ledger-summary">{frontmatter.summary}</p>}

      {hasSkills(frontmatter.skills) && (
        <section className="resume-ledger-skills resume-section" aria-label="skills">
          <span>SKILLS</span>
          <ResumeSkills skills={frontmatter.skills} />
        </section>
      )}

      <div className="resume-ledger-body">
        {sections.map((section, index) => (
          <section className="resume-ledger-section" key={`${section.title}-${index}`}>
            <div className="resume-ledger-section-label">
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              <h2>{section.title}</h2>
            </div>
            <div className="resume-body resume-ledger-section-content">
              <ResumeMarkdown>{section.body}</ResumeMarkdown>
            </div>
          </section>
        ))}
      </div>
    </TemplateBase>
  );
}
