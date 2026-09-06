import React from "react";
import { TemplateBase, mergeThemeVariables, type TemplateProps } from "./base";
import { collectionThemes, type CollectionId } from "./collection";
import { ResumeMarkdown } from "./resume-markdown";
import { hasSkills, ResumeSkills } from "./resume-skills";
import { basicsValues, splitResumeSections } from "./sections";
import { getResumeLanguage } from "./language";

/** Five compositions share content semantics and a print-safe typography system. */
export function Folio({
  variant,
  frontmatter: fm,
  body,
  themeVariables,
  photo,
}: TemplateProps & { variant: CollectionId }) {
  const vars = mergeThemeVariables(collectionThemes[variant], themeVariables);
  const language = getResumeLanguage(fm, body);
  const zh = language === "zh-CN";
  const sections = splitResumeSections(body);
  const rail = variant === "editorial" || variant === "blueprint";
  const contacts = Object.entries(fm.contact ?? {}).filter(([, value]) =>
    value?.trim(),
  );
  const basics = basicsValues(fm.basics);
  const labels: Record<string, string> = {
    email: "EMAIL",
    phone: "TEL",
    website: "WEB",
    github: "GITHUB",
    linkedin: "LINKEDIN",
    location: "LOCATION",
  };
  const contact = (contacts.length > 0 || basics.length > 0) && (
    <div className="folio-contact">
      {contacts.map(([key, value]) => (
        <span key={key} className="folio-contact-item">
          {(variant === "ledger" || variant === "blueprint") && (
            <span className="folio-contact-label">{labels[key]}</span>
          )}
          <span>{value}</span>
        </span>
      ))}
      {basics.length > 0 && <span className="folio-contact-item">{basics.join(" · ")}</span>}
    </div>
  );
  const profile = fm.summary && (
    <section
      className="folio-profile resume-section"
      data-folio-block="summary"
    >
      <h2 className="folio-label">{zh ? "个人简介" : "Profile"}</h2>
      <p
        className={
          variant === "editorial" && !zh && /^[A-Za-z]/.test(fm.summary.trim())
            ? "resume-dropcap"
            : undefined
        }
      >
        {fm.summary}
      </p>
    </section>
  );
  const skills = hasSkills(fm.skills) && (
    <section className="folio-skills resume-section" data-folio-block="skills">
      <h2 className="folio-label">{zh ? "专业技能" : "Expertise"}</h2>
      <ResumeSkills skills={fm.skills} />
    </section>
  );
  const experience = (
    <div className="folio-experience">
      {sections.map((section, index) => (
        <section className="folio-section" key={`${index}-${section.title}`}>
          <div className="folio-section-heading">
            {variant === "ledger" && (
              <span className="folio-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
            )}
            {section.heading ? (
              <ResumeMarkdown>{section.heading}</ResumeMarkdown>
            ) : (
              <h2>{section.title}</h2>
            )}
          </div>
          <div className="resume-body folio-section-content">
            <ResumeMarkdown>{section.body}</ResumeMarkdown>
          </div>
        </section>
      ))}
    </div>
  );
  const imagePosition = typeof vars.photoPosition === "number" && Number.isFinite(vars.photoPosition)
    ? Math.max(0, Math.min(100, vars.photoPosition)) : 35;
  const portrait = photo ? <figure className="folio-photo">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={photo} className="resume-photo" alt="" width={300} height={400}
      style={{ objectFit: vars.photoFit === "contain" ? "contain" : "cover", objectPosition: `50% ${imagePosition}%` }} />
  </figure> : null;
  return (
    <TemplateBase themeId={variant} vars={vars} language={language}>
      <div className={`folio folio-${variant}${photo ? " folio-has-portrait" : ""}${photo && vars.photoLayout === "floating-monolith" ? " folio-portrait-large" : ""}`}>
        <header
          className={`folio-header${photo && variant !== "editorial" ? " folio-with-photo" : ""}`}
        >
          <div className="folio-identity">
            {fm.name && <h1>{fm.name}</h1>}
            {fm.title && <p className="folio-role">{fm.title}</p>}
          </div>
          {variant !== "editorial" && portrait}
          {!rail && contact}
        </header>
        {rail ? (
          <div className="folio-columns">
            <aside className="folio-rail">
              {variant === "editorial" && portrait}
              {contact}
              {profile}
              {skills}
            </aside>
            {experience}
          </div>
        ) : (
          <>
            {profile}
            {variant !== "authority" && skills}
            {experience}
            {variant === "authority" && skills}
          </>
        )}
      </div>
    </TemplateBase>
  );
}
