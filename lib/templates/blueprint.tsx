import React from "react";
import { MailIcon, PhoneIcon, GlobeIcon, MapPinIcon, GithubMark, LinkedinMark } from "./icons";
import { TemplateProps, TemplateBase, mergeThemeVariables } from "./base";
import { ResumeMarkdown } from "./resume-markdown";
import { hasSkills, ResumeSkills } from "./resume-skills";
import { splitResumeSections } from "./sections";
import { ThemeVariables } from "../types";

export const blueprintDefaultTheme: ThemeVariables = {
  primaryColor: "#1452c2",
  secondaryColor: "#52647d",
  backgroundColor: "#ffffff",
  textColor: "#111a2d",
  fontFamily: "var(--font-plex-sans), -apple-system, var(--resume-cjk-sans)",
  headingFontFamily: "var(--font-inter-tight), -apple-system, var(--resume-cjk-sans)",
  baseFontSize: "9.4pt",
  lineHeight: 1.46,
  marginTop: "10mm",
  marginBottom: "10mm",
  marginLeft: "10mm",
  marginRight: "10mm",
};

export function BlueprintTemplate({ frontmatter, body, themeVariables, photo }: TemplateProps) {
  const vars = mergeThemeVariables(blueprintDefaultTheme, themeVariables);
  const c = frontmatter.contact;
  const sections = splitResumeSections(body);

  const contacts: { label: string; icon: React.ReactElement }[] = [];
  if (c?.email) contacts.push({ label: c.email, icon: <MailIcon /> });
  if (c?.phone) contacts.push({ label: c.phone, icon: <PhoneIcon /> });
  if (c?.github) contacts.push({ label: c.github, icon: <GithubMark /> });
  if (c?.website) contacts.push({ label: c.website, icon: <GlobeIcon /> });
  if (c?.linkedin) contacts.push({ label: c.linkedin, icon: <LinkedinMark /> });
  if (c?.location) contacts.push({ label: c.location, icon: <MapPinIcon /> });

  return (
    <TemplateBase themeId="blueprint" vars={vars}>
      <div className="resume-blueprint-frame-label">
        <span>Systems Blueprint</span>
        <span>Resume / 01</span>
      </div>

      <header className={`resume-blueprint-header${photo ? " has-photo" : ""}`}>
        {photo && (
          <figure className="resume-blueprint-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="resume-photo" />
          </figure>
        )}
        <div className="resume-blueprint-identity">
          <div className="resume-blueprint-name-row">
            {frontmatter.name && <h1>{frontmatter.name}</h1>}
            <div>
              {frontmatter.title && <p className="resume-blueprint-role">{frontmatter.title}</p>}
              <p className="resume-blueprint-focus">专注于产品体验与前端工程化</p>
            </div>
          </div>
          {contacts.length > 0 && (
            <div className="resume-blueprint-contact">
              {contacts.map((item) => (
                <span key={item.label}>
                  {item.icon}
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="resume-blueprint-layout">
        <aside className="resume-blueprint-sidebar">
          {frontmatter.summary && (
            <section className="resume-blueprint-panel resume-section">
              <h2>Profile</h2>
              <p>{frontmatter.summary}</p>
            </section>
          )}
          {hasSkills(frontmatter.skills) && (
            <section className="resume-blueprint-panel resume-section">
              <h2>Core Stack</h2>
              <ResumeSkills skills={frontmatter.skills} />
            </section>
          )}
          <section className="resume-blueprint-panel resume-blueprint-meta resume-section">
            <h2>Meta</h2>
            <dl>
              {Object.entries(frontmatter.basics ?? {}).map(([key, value]) => (
                <React.Fragment key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </React.Fragment>
              ))}
              {Object.keys(frontmatter.basics ?? {}).length === 0 && (
                <>
                  <dt>LANGUAGE</dt>
                  <dd>中文 / English</dd>
                  <dt>FOCUS</dt>
                  <dd>Design & Build</dd>
                  <dt>FORMAT</dt>
                  <dd>Markdown / PDF</dd>
                </>
              )}
            </dl>
          </section>
        </aside>

        <main className="resume-blueprint-body">
          {sections.map((section, index) => (
            <section className="resume-blueprint-section" key={`${section.title}-${index}`}>
              <div className="resume-blueprint-section-heading">
                <h2>{section.title}</h2>
                <span>C.{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div className="resume-body resume-blueprint-section-content">
                <ResumeMarkdown>{section.body}</ResumeMarkdown>
              </div>
            </section>
          ))}
        </main>
      </div>
    </TemplateBase>
  );
}
