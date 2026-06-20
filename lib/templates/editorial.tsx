import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ModernHeader } from "@/components/modern-header";
import { TemplateProps, TemplateBase, mergeThemeVariables } from "./base";
import { themedMarkdownComponents } from "./markdown";
import { ThemeVariables } from "../types";

export const editorialDefaultTheme: ThemeVariables = {
  primaryColor: "#3a2415",
  secondaryColor: "#a87b3f",
  backgroundColor: "#faf6ed",
  textColor: "#2a1c10",
  fontFamily: "var(--font-fraunces), 'Iowan Old Style', Georgia, serif",
  headingFontFamily: "var(--font-fraunces), serif",
  baseFontSize: "10.5pt",
  lineHeight: 1.62,
  marginTop: "22mm",
  marginBottom: "22mm",
  marginLeft: "26mm",
  marginRight: "26mm",
};

function joinContact(c?: TemplateProps["frontmatter"]["contact"]): string[] {
  if (!c) return [];
  const parts: string[] = [];
  if (c.location) parts.push(c.location);
  if (c.email) parts.push(c.email);
  if (c.website) parts.push(c.website);
  if (c.github) parts.push(c.github);
  if (c.linkedin) parts.push(c.linkedin);
  if (c.phone) parts.push(c.phone);
  return parts;
}

export function EditorialTemplate({ frontmatter, body, themeVariables, photo }: TemplateProps) {
  const vars = mergeThemeVariables(editorialDefaultTheme, themeVariables);
  const contactParts = joinContact(frontmatter.contact);
  const useModernHeader = vars.photoLayout === "floating-monolith";

  return (
    <TemplateBase themeId="editorial" vars={vars}>
      {useModernHeader && photo ? (
        <ModernHeader frontmatter={frontmatter} photo={photo} />
      ) : (
        <header className="resume-editorial-header">
          <div className="resume-eyebrow">VOL · {new Date().getFullYear()}</div>
          <div className="resume-editorial-mast">
            <div className="resume-editorial-name">
              {frontmatter.title && <div className="resume-overline">— {frontmatter.title} —</div>}
              {frontmatter.name && <h1 className="resume-h1">{frontmatter.name}</h1>}
            </div>
            {photo && (
              <figure className="resume-photo-figure resume-photo-figure--editorial">
                <div className="resume-editorial-photo-plate">
                  <div className="resume-editorial-photo-frame">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="" className="resume-photo" />
                  </div>
                </div>
                <figcaption className="resume-photo-caption">portrait · {new Date().getFullYear()}</figcaption>
              </figure>
            )}
          </div>
          {contactParts.length > 0 && (
            <p className="resume-meta">{contactParts.join("  ·  ")}</p>
          )}
        </header>
      )}

      {frontmatter.summary && (
        <section className="resume-summary resume-section">
          <p className="resume-dropcap">{frontmatter.summary}</p>
        </section>
      )}

      {frontmatter.skills && frontmatter.skills.length > 0 && (
        <section className="resume-skills resume-section">
          <h2 className="resume-rule-h2">Practice</h2>
          <p>{frontmatter.skills.join(" · ")}</p>
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
