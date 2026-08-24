import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResumeSkills } from "./resume-skills";

describe("ResumeSkills", () => {
  it("renders category labels and individual tokens", () => {
    const html = renderToStaticMarkup(
      <ResumeSkills
        skills={{
          AI: ["Agent", "RAG", "Memory"],
          Backend: "Java / Kotlin",
        }}
      />
    );

    expect(html).toContain("resume-skill-group-label");
    expect(html).toContain("AI");
    expect(html).toContain("Backend");
    expect(html).toContain("Agent");
    expect(html).toContain("Kotlin");
    expect(html).toContain("resume-skill-sep");
    expect(html).toContain(" / ");
    expect(html.match(/resume-skill-sep/g)?.length).toBe(3);
  });

  it("renders nothing when skills are empty", () => {
    expect(renderToStaticMarkup(<ResumeSkills skills={{}} />)).toBe("");
  });
});
