import React from "react";
import { TemplateBase, mergeThemeVariables, type TemplateProps } from "./base";
import { collectionThemes, type CollectionId } from "./collection";
import { ResumeMarkdown } from "./resume-markdown";
import { hasSkills, ResumeSkills } from "./resume-skills";
import { basicsValues, splitResumeSections, type ResumeSection } from "./sections";
import { getResumeLanguage } from "./language";
import { photoObjectPosition } from "./photo";

const LINKISH = /^[^\s]+$/;
const LINK_SEPARATORS = /(?<=[/.@?#&=])/;
// 超过这个长度的片段允许在内部断开，避免溢出窄栏
const MAX_UNBREAKABLE = 22;

/**
 * 网址和邮箱只在 / . @ 等分隔符之后换行，不在连字符处断开
 * （github.com/yuan-chen-demo 不会断成「yuan-chen-」+「demo」）。
 * 只插入 <wbr>，文字本身不变，PDF 里复制出来仍是完整地址。
 */
export function breakableContact(value: string): React.ReactNode {
  const text = value.trim();
  if (!LINKISH.test(text) || !/[/@.]/.test(text)) return text;
  const parts = text.split(LINK_SEPARATORS).filter(Boolean);
  if (parts.length < 2 && text.length <= MAX_UNBREAKABLE) return <span className="folio-nobreak">{text}</span>;
  return parts.map((part, index) => (
    <React.Fragment key={index}>
      {index > 0 && <wbr />}
      {part.length <= MAX_UNBREAKABLE ? <span className="folio-nobreak">{part}</span> : part}
    </React.Fragment>
  ));
}

const ROLE_SEPARATOR = /\s+([·|｜/])\s+/;

/**
 * 职位常写成「A · B」：按分隔符切成整体换行的短语，避免窄栏里只把最后两个字挤到下一行。
 * 分隔符跟在前一个短语末尾；短语用 inline-block，超长短语仍可在内部折行，不会溢出。
 */
export function breakableRole(value: string): React.ReactNode {
  const tokens = value.split(ROLE_SEPARATOR);
  if (tokens.length < 3) return value;
  const phrases: string[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    phrases.push(i + 1 < tokens.length ? `${tokens[i]} ${tokens[i + 1]}` : tokens[i]);
  }
  return phrases.map((phrase, index) => (
    <React.Fragment key={index}>
      {index > 0 && " "}
      <span className="folio-phrase">{phrase}</span>
    </React.Fragment>
  ));
}

const RAIL_NOTE_TITLE = /^(荣誉|奖项|获奖|证书|资格|认证|语言|兴趣|爱好|awards?|honou?rs|certifications?|certificates|languages?|interests)/i;

/** Eight compositions share content semantics and a print-safe typography system. */
export function Folio({
  variant,
  frontmatter: fm,
  body,
  themeVariables,
  photo,
  editing,
}: TemplateProps & { variant: CollectionId }) {
  const vars = mergeThemeVariables(collectionThemes[variant], themeVariables);
  const language = getResumeLanguage(fm, body);
  const zh = language === "zh-CN";
  const sections = splitResumeSections(body);
  const rail = variant === "editorial" || variant === "blueprint" || variant === "sidebar";
  // 侧栏：姓名、照片和联系方式都在通栏色带里，主栏只放简介与经历。
  const identityInRail = variant === "sidebar";
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
          {(variant === "ledger" || variant === "blueprint" || variant === "sidebar") && (
            <span className="folio-contact-label">{labels[key]}</span>
          )}
          <span className="folio-contact-value">{breakableContact(value)}</span>
        </span>
      ))}
      {basics.length > 0 && <span className="folio-contact-item folio-contact-basics">{basics.join(" · ")}</span>}
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
        {...editing?.fieldProps("summary")}
      >
        {editing ? editing.fieldText("summary", fm.summary) : fm.summary}
      </p>
    </section>
  );
  const skills = hasSkills(fm.skills) && (
    <section className="folio-skills resume-section" data-folio-block="skills">
      {rail ? (
        <h2 className="folio-label">{zh ? "专业技能" : "Expertise"}</h2>
      ) : (
        <div className="folio-section-heading">
          <h2>{zh ? "专业技能" : "Expertise"}</h2>
        </div>
      )}
      <ResumeSkills skills={fm.skills} />
    </section>
  );
  // 纸刊 / 构筑：荣誉、证书、语言这类短清单放进侧栏，排在技能之后，
  // 让第二页的侧栏和主栏一起收尾，而不是主栏写满、侧栏空着。
  const railNotes = variant === "editorial" || variant === "blueprint";
  const isNote = (section: ResumeSection) => railNotes && RAIL_NOTE_TITLE.test(section.title.trim());
  const renderSection = (section: ResumeSection, index: number, className: string) => (
    <section className={className} key={`${index}-${section.title}`}>
      <div className="folio-section-heading">
        {variant === "ledger" && (
          <span className="folio-index" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        {section.heading ? (
          <ResumeMarkdown editing={editing}>{section.heading}</ResumeMarkdown>
        ) : (
          <h2>{section.title}</h2>
        )}
      </div>
      <div className="resume-body folio-section-content">
        <ResumeMarkdown editing={editing}>{section.body}</ResumeMarkdown>
      </div>
    </section>
  );
  const mainSections = sections.filter((section) => !isNote(section));
  const noteSections = sections.filter(isNote);
  const experience = (
    <div className="folio-experience">
      {mainSections.map((section, index) => renderSection(section, index, "folio-section"))}
    </div>
  );
  const notes = noteSections.length > 0 && (
    <div className="folio-rail-notes">
      {noteSections.map((section, index) => renderSection(section, index, "folio-section folio-rail-note"))}
    </div>
  );
  const contain = vars.photoFit === "contain";
  const portrait = photo ? <figure className="folio-photo">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={photo} className="resume-photo" alt="" width={300} height={400}
      data-fit={contain ? "contain" : undefined}
      style={{ objectFit: contain ? "contain" : "cover", objectPosition: photoObjectPosition(vars) }} />
  </figure> : null;
  const header = (
    <header
      className={`folio-header${photo && variant !== "editorial" && !identityInRail ? " folio-with-photo" : ""}`}
    >
      {identityInRail && portrait}
      <div className="folio-identity">
        {/* 编辑时空字段也占位，方便从零开始直接填写 */}
        {(fm.name || editing) && (
          <h1 {...editing?.fieldProps("name")}>
            {editing ? editing.fieldText("name", fm.name) : fm.name}
          </h1>
        )}
        {(fm.title || editing) && (
          <p className="folio-role" {...editing?.fieldProps("title")}>
            {editing ? editing.fieldText("title", fm.title) : breakableRole(fm.title ?? "")}
          </p>
        )}
      </div>
      {variant !== "editorial" && !identityInRail && portrait}
      {!rail && contact}
    </header>
  );
  return (
    <TemplateBase themeId={variant} vars={vars} language={language}>
      <div className={`folio folio-${variant}${photo ? " folio-has-portrait" : ""}${photo && vars.photoLayout === "floating-monolith" ? " folio-portrait-large" : ""}`}>
        {!identityInRail && header}
        {rail ? (
          <div className="folio-columns">
            <aside className="folio-rail">
              {identityInRail && header}
              {variant === "editorial" && portrait}
              {contact}
              {!identityInRail && profile}
              {skills}
              {notes}
            </aside>
            {identityInRail ? (
              <div className="folio-main">
                {profile}
                {experience}
              </div>
            ) : (
              experience
            )}
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
