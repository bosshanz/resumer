import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ModernHeader } from "@/components/modern-header";
import { TemplateProps, TemplateBase, mergeThemeVariables } from "./base";
import { themedMarkdownComponents } from "./markdown";
import { ThemeVariables } from "../types";

export const gridDefaultTheme: ThemeVariables = {
  primaryColor: "#000000",
  secondaryColor: "#dc2626",
  backgroundColor: "#ffffff",
  textColor: "#0a0a0a",
  fontFamily: "var(--font-geist-sans), -apple-system, sans-serif",
  headingFontFamily: "var(--font-geist-sans), sans-serif",
  baseFontSize: "10pt",
  lineHeight: 1.5,
  marginTop: "20mm",
  marginBottom: "20mm",
  marginLeft: "22mm",
  marginRight: "20mm",
};

export function GridTemplate({ frontmatter, body, themeVariables, photo }: TemplateProps) {
  const vars = mergeThemeVariables(gridDefaultTheme, themeVariables);
  const c = frontmatter.contact;
  const useModernHeader = vars.photoLayout === "floating-monolith";
  const contactList: { label: string; value: string }[] = [];
  if (c?.email) contactList.push({ label: "EMAIL", value: c.email });
  if (c?.phone) contactList.push({ label: "TEL", value: c.phone });
  if (c?.github) contactList.push({ label: "GH", value: c.github });
  if (c?.website) contactList.push({ label: "WEB", value: c.website });
  if (c?.linkedin) contactList.push({ label: "LI", value: c.linkedin });
  if (c?.location) contactList.push({ label: "LOC", value: c.location });

  return (
    <TemplateBase themeId="grid" vars={vars}>
      {useModernHeader && photo ? (
        <ModernHeader frontmatter={frontmatter} photo={photo} />
      ) : (
        <header className="resume-grid-header">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="resume-photo" />
          )}
          <div className="resume-grid-header-text">
            {frontmatter.title && <div className="resume-eyebrow">{frontmatter.title}</div>}
            {frontmatter.name && <h1 className="resume-h1">{frontmatter.name}</h1>}

            {contactList.length > 0 && (
              <dl className="resume-contact-grid">
                {contactList.map((item) => (
                  <React.Fragment key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </React.Fragment>
                ))}
              </dl>
            )}
          </div>
        </header>
      )}

      {frontmatter.summary && <p className="resume-summary resume-section">{frontmatter.summary}</p>}

      {frontmatter.skills && frontmatter.skills.length > 0 && (
        <section className="resume-skills resume-section">
          <h2>SKILLS</h2>
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
