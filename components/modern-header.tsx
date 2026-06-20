import React from "react";
import { ResumeFrontmatter } from "@/lib/types";

interface ModernHeaderProps {
  frontmatter: ResumeFrontmatter;
  photo?: string;
}

function joinContact(c?: ResumeFrontmatter["contact"]): string[] {
  if (!c) return [];
  const parts: string[] = [];
  if (c.email) parts.push(c.email);
  if (c.phone) parts.push(c.phone);
  if (c.location) parts.push(c.location);
  if (c.website) parts.push(c.website);
  if (c.github) parts.push(c.github);
  if (c.linkedin) parts.push(c.linkedin);
  return parts;
}

export function ModernHeader({ frontmatter, photo }: ModernHeaderProps) {
  const contactParts = joinContact(frontmatter.contact);

  return (
    <header className="resume-modern-header">
      {photo && (
        <figure className="resume-modern-photo-figure">
          <div className="resume-modern-photo-shell">
            <div className="resume-modern-photo-core">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="resume-photo resume-modern-photo" />
            </div>
          </div>
        </figure>
      )}
      <div className="resume-modern-titling">
        {frontmatter.title && (
          <span className="resume-modern-eyebrow">{frontmatter.title}</span>
        )}
        {frontmatter.name && <h1 className="resume-modern-h1">{frontmatter.name}</h1>}
        {contactParts.length > 0 && (
          <p className="resume-modern-contact">{contactParts.join(" · ")}</p>
        )}
      </div>
    </header>
  );
}
