import React from "react";
import { hasSkills, normalizeSkillGroups, ResumeSkills as SkillsInput } from "../skills";

export function ResumeSkills({
  skills,
  className,
}: {
  skills?: SkillsInput;
  className?: string;
}) {
  const groups = normalizeSkillGroups(skills);
  if (groups.length === 0) return null;

  const labeled = groups.some((group) => group.label);

  return (
    <div
      className={["resume-skill-groups", labeled ? "resume-skill-groups--labeled" : "", className]
        .filter(Boolean)
        .join(" ")}
      aria-label="skills"
    >
      {groups.map((group, index) => (
        <div className="resume-skill-group" key={group.label || group.items.join("-") || index}>
          {group.label && <span className="resume-skill-group-label">{group.label}</span>}
          <span className="resume-skill-group-items">
            {group.items.map((item, itemIndex) => (
              <span key={`${group.label || "group"}-${item}`}>
                {itemIndex > 0 && (
                  <span className="resume-skill-sep" aria-hidden>
                    {" / "}
                  </span>
                )}
                <span className="resume-skill-tag">{item}</span>
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export { hasSkills };
