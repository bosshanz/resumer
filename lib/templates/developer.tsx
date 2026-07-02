import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ModernHeader } from "@/components/modern-header";
import { MailIcon, PhoneIcon, GlobeIcon, MapPinIcon, GithubMark, LinkedinMark } from "./icons";
import { TemplateProps, TemplateBase, mergeThemeVariables } from "./base";
import { themedMarkdownComponents } from "./markdown";
import { ThemeVariables } from "../types";

export const developerDefaultTheme: ThemeVariables = {
  primaryColor: "#2d5a3d",
  secondaryColor: "#6a7570",
  backgroundColor: "#fbfaf7",
  textColor: "#18221c",
  fontFamily: "var(--font-inter-tight), -apple-system, sans-serif",
  headingFontFamily: "var(--font-inter-tight), sans-serif",
  baseFontSize: "10.5pt",
  lineHeight: 1.6,
  marginTop: "18mm",
  marginBottom: "18mm",
  marginLeft: "20mm",
  marginRight: "20mm",
};

export function DeveloperTemplate({ frontmatter, body, themeVariables, photo }: TemplateProps) {
  const vars = mergeThemeVariables(developerDefaultTheme, themeVariables);
  const c = frontmatter.contact;
  const useModernHeader = vars.photoLayout === "floating-monolith";

  return (
    <TemplateBase themeId="developer" vars={vars}>
      {useModernHeader && photo ? (
        <ModernHeader frontmatter={frontmatter} photo={photo} />
      ) : (
        <header className="resume-header">
          {photo && (
            <div className="resume-developer-photo-shell">
              <div className="resume-developer-photo-core">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="" className="resume-photo" />
              </div>
            </div>
          )}
          <div className="resume-developer-titling">
            <div className="resume-developer-name-row">
              {frontmatter.name && <h1 className="resume-h1">{frontmatter.name}</h1>}
              {frontmatter.title && <span className="resume-title-tag">{frontmatter.title}</span>}
            </div>
            {c && (
              <div className="resume-contact">
                {c.email && (
                  <span className="resume-contact-item">
                    {c.email} <MailIcon />
                  </span>
                )}
                {c.phone && (
                  <span className="resume-contact-item">
                    {c.phone} <PhoneIcon />
                  </span>
                )}
                {c.github && (
                  <span className="resume-contact-item">
                    {c.github} <GithubMark />
                  </span>
                )}
                {c.website && (
                  <span className="resume-contact-item">
                    {c.website} <GlobeIcon />
                  </span>
                )}
                {c.linkedin && (
                  <span className="resume-contact-item">
                    {c.linkedin} <LinkedinMark />
                  </span>
                )}
                {c.location && (
                  <span className="resume-contact-item">
                    {c.location} <MapPinIcon />
                  </span>
                )}
              </div>
            )}
          </div>
        </header>
      )}

      {frontmatter.summary && (
        <section className="resume-summary resume-section">{frontmatter.summary}</section>
      )}

      {frontmatter.skills && frontmatter.skills.length > 0 && (
        <section className="resume-skills resume-section" aria-label="skills">
          {frontmatter.skills.map((s, i) => (
            <span key={i} className="resume-skill resume-skill-primary">
              {s}
            </span>
          ))}
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
