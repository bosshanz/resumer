import React from "react";
import { ModernHeader } from "@/components/modern-header";
import { TemplateProps, TemplateBase, mergeThemeVariables } from "./base";
import { ResumeMarkdown } from "./resume-markdown";
import { hasSkills, ResumeSkills } from "./resume-skills";
import { splitResumeSections } from "./sections";
import { ThemeVariables } from "../types";

export const gridDefaultTheme: ThemeVariables = {
  primaryColor: "#000000",
  secondaryColor: "#dc2626",
  backgroundColor: "#ffffff",
  textColor: "#0a0a0a",
  fontFamily: "var(--font-geist-sans), -apple-system, var(--resume-cjk-sans)",
  headingFontFamily: "var(--font-geist-sans), var(--resume-cjk-sans)",
  baseFontSize: "10pt",
  lineHeight: 1.5,
  marginTop: "20mm",
  marginBottom: "20mm",
  marginLeft: "22mm",
  marginRight: "20mm",
};

// 左轨收纳短小的事实性章节；工作/项目等叙事章节留在主栏按时间编号。
const railSectionPattern = /教育|学历|校园|证书|认证|语言|获奖|荣誉|兴趣|其他|补充/;

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

  const sections = splitResumeSections(body);
  const railSections = useModernHeader ? [] : sections.filter((s) => railSectionPattern.test(s.title));
  const mainSections = useModernHeader
    ? sections
    : sections.filter((s) => !railSectionPattern.test(s.title));
  const basicEntries = Object.entries(frontmatter.basics ?? {});
  const hasRail =
    !useModernHeader &&
    (contactList.length > 0 ||
      basicEntries.length > 0 ||
      Boolean(frontmatter.summary) ||
      hasSkills(frontmatter.skills) ||
      railSections.length > 0);

  return (
    <TemplateBase themeId="grid" vars={vars}>
      {useModernHeader && photo ? (
        <ModernHeader frontmatter={frontmatter} photo={photo} />
      ) : (
        <header className="resume-grid-header">
          <div className="resume-grid-header-text">
            {frontmatter.title && <div className="resume-eyebrow">{frontmatter.title}</div>}
            {frontmatter.name && <h1 className="resume-h1">{frontmatter.name}</h1>}
          </div>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="resume-photo" />
          )}
        </header>
      )}

      {useModernHeader ? (
        <>
          {frontmatter.summary && <p className="resume-summary resume-section">{frontmatter.summary}</p>}
          {hasSkills(frontmatter.skills) && (
            <section className="resume-skills resume-section">
              <h2>SKILLS</h2>
              <ResumeSkills skills={frontmatter.skills} />
            </section>
          )}
          <section className="resume-body">
            <ResumeMarkdown>{body}</ResumeMarkdown>
          </section>
        </>
      ) : (
        <div className={`resume-grid-layout${hasRail ? "" : " resume-grid-layout--single"}`}>
          {hasRail && (
            <aside className="resume-grid-rail">
              {(basicEntries.length > 0 || contactList.length > 0) && (
                <section className="resume-grid-block resume-section">
                  <h2>Contact</h2>
                  <dl className="resume-contact-grid">
                    {basicEntries.map(([label, value]) => (
                      <React.Fragment key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </React.Fragment>
                    ))}
                    {contactList.map((item) => (
                      <React.Fragment key={item.label}>
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </section>
              )}
              {frontmatter.summary && (
                <section className="resume-grid-block resume-section">
                  <h2>Profile</h2>
                  <p className="resume-summary">{frontmatter.summary}</p>
                </section>
              )}
              {hasSkills(frontmatter.skills) && (
                <section className="resume-grid-block resume-section">
                  <h2>Skills</h2>
                  <ResumeSkills skills={frontmatter.skills} />
                </section>
              )}
              {railSections.map((section, index) => (
                <section className="resume-grid-block resume-section" key={`${section.title}-${index}`}>
                  <h2>{section.title}</h2>
                  <div className="resume-body resume-grid-block-body">
                    <ResumeMarkdown>{section.body}</ResumeMarkdown>
                  </div>
                </section>
              ))}
            </aside>
          )}
          <main className="resume-grid-main">
            {mainSections.map((section, index) => (
              <section key={`${section.title}-${index}`}>
                <h2>{section.title}</h2>
                <div className="resume-body">
                  <ResumeMarkdown>{section.body}</ResumeMarkdown>
                </div>
              </section>
            ))}
          </main>
        </div>
      )}
    </TemplateBase>
  );
}
