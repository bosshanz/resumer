import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TemplateProps, TemplateBase, mergeThemeVariables } from "./base";
import { themedMarkdownComponents } from "./markdown";
import { ThemeVariables } from "../types";

export const minimalDefaultTheme: ThemeVariables = {
  primaryColor: "#111111",
  secondaryColor: "#666666",
  backgroundColor: "#ffffff",
  textColor: "#111111",
  fontFamily: "var(--font-fraunces), 'Iowan Old Style', Georgia, serif",
  headingFontFamily: "var(--font-fraunces), serif",
  baseFontSize: "10.5pt",
  lineHeight: 1.65,
  marginTop: "22mm",
  marginBottom: "22mm",
  marginLeft: "26mm",
  marginRight: "26mm",
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

export function MinimalTemplate({ frontmatter, body, themeVariables, photo }: TemplateProps) {
  const vars = mergeThemeVariables(minimalDefaultTheme, themeVariables);
  const contactParts = joinContact(frontmatter.contact);

  return (
    <TemplateBase themeId="minimal" vars={vars}>
      <header style={{ marginBottom: "2.2em" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1em" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {frontmatter.title && <div className="resume-eyebrow">{frontmatter.title}</div>}
            {frontmatter.name && (
              <h1 className="resume-h1" style={{ marginTop: "0.45em", marginBottom: "0.7em" }}>
                {frontmatter.name}
              </h1>
            )}
          </div>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="resume-photo" />
          )}
        </div>
        <hr className="resume-divider" />
        {contactParts.length > 0 && (
          <p className="resume-meta" style={{ marginTop: "0.7em" }}>
            {contactParts.join(" · ")}
          </p>
        )}
      </header>

      {frontmatter.summary && (
        <section
          className="resume-section"
          style={{
            marginBottom: "2em",
            fontSize: "1.05em",
            maxWidth: "62ch",
            fontStyle: "italic",
            lineHeight: 1.55,
          }}
        >
          {frontmatter.summary}
        </section>
      )}

      {frontmatter.skills && frontmatter.skills.length > 0 && (
        <section className="resume-section" style={{ marginBottom: "1.8em" }}>
          <div className="resume-eyebrow" style={{ marginBottom: "0.4em" }}>
            Skills
          </div>
          <p style={{ margin: 0, fontSize: "0.96em", lineHeight: 1.55 }}>
            {frontmatter.skills.join(" · ")}
          </p>
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
