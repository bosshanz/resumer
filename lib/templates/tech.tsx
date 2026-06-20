import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mail, Phone, Globe, MapPin } from "lucide-react";
import { GithubMark, LinkedinMark } from "./icons";
import { TemplateProps, TemplateBase, mergeThemeVariables } from "./base";
import { themedMarkdownComponents } from "./markdown";
import { ThemeVariables } from "../types";

export const techDefaultTheme: ThemeVariables = {
  primaryColor: "#0a3a5c",
  secondaryColor: "#5a6b7d",
  backgroundColor: "#fbfaf6",
  textColor: "#1a2332",
  fontFamily: "var(--font-plex-sans), -apple-system, sans-serif",
  headingFontFamily: "var(--font-plex-sans), sans-serif",
  baseFontSize: "10.5pt",
  lineHeight: 1.55,
  marginTop: "16mm",
  marginBottom: "16mm",
  marginLeft: "18mm",
  marginRight: "18mm",
};

export function TechTemplate({ frontmatter, body, themeVariables, photo }: TemplateProps) {
  const vars = mergeThemeVariables(techDefaultTheme, themeVariables);
  const c = frontmatter.contact;

  return (
    <TemplateBase themeId="tech" vars={vars}>
      <div className="resume-banner">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1.2em" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {frontmatter.name && <h1 className="resume-h1">{frontmatter.name}</h1>}
            {frontmatter.title && <div className="resume-h1-mono">{`> ${frontmatter.title}`}</div>}
          </div>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="resume-photo" style={{ flexShrink: 0 }} />
          )}
          {c && (
            <div className="resume-contact" style={{ flexShrink: 0 }}>
              {c.email && (
                <span className="resume-contact-item">
                  <Mail aria-hidden /> {c.email}
                </span>
              )}
              {c.phone && (
                <span className="resume-contact-item">
                  <Phone aria-hidden /> {c.phone}
                </span>
              )}
              {c.github && (
                <span className="resume-contact-item">
                  <GithubMark /> {c.github}
                </span>
              )}
              {c.website && (
                <span className="resume-contact-item">
                  <Globe aria-hidden /> {c.website}
                </span>
              )}
              {c.linkedin && (
                <span className="resume-contact-item">
                  <LinkedinMark /> {c.linkedin}
                </span>
              )}
              {c.location && (
                <span className="resume-contact-item">
                  <MapPin aria-hidden /> {c.location}
                </span>
              )}
            </div>
          )}
        </div>

        {frontmatter.skills && frontmatter.skills.length > 0 && (
          <div className="resume-skills-strip" aria-label="skills">
            {frontmatter.skills.map((s, i) => (
              <span key={i} className="resume-skill-tag">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {frontmatter.summary && (
        <section className="resume-summary resume-section">{frontmatter.summary}</section>
      )}

      <section className="resume-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={themedMarkdownComponents}>
          {body}
        </ReactMarkdown>
      </section>
    </TemplateBase>
  );
}
