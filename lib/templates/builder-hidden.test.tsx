import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { templates } from "./index";
import { parseResumeContent } from "../parser";
import {
  readBuilder,
  togglePiece,
  splitPieces,
  replacePiece,
  joinPieces,
  stripHiddenBlocks,
} from "../resume-builder";

describe("hidden builder blocks in presentation", () => {
  const sections = readBuilder(
    "## Work\n\n### Visible company\n\nVisible achievement\n\n### Hidden company\n\nHidden achievement\n\n## Hidden section\n\nHidden section content",
  ).sections;
  const entries = splitPieces(sections[0].body, 3);
  const index = entries.findIndex((e) => e.title === "Hidden company");
  entries[index] = togglePiece(entries[index]);
  sections[0] = replacePiece(
    sections[0],
    sections[0].heading + joinPieces(entries),
  );
  sections[1] = togglePiece(sections[1]);
  const content = joinPieces(sections);
  const { body } = parseResumeContent(content);
  it.each(templates)(
    "$id omits hidden sections, entries and internal annotations",
    (template) => {
      const html = renderToStaticMarkup(
        React.createElement(template.component, {
          frontmatter: { name: "Test" },
          body,
          themeVariables: template.defaultTheme,
        }),
      );
      expect(html).toContain("Visible achievement");
      expect(html).not.toContain("Hidden");
      expect(html).not.toContain("resumer-hidden");
      expect(html).not.toContain("简历详情");
    },
  );
  it("retains hidden source for reopening and leaves examples in fences untouched", () => {
    expect(readBuilder(content).sections[1].hidden).toBe(true);
    const fenced = "```md\n" + sections[1].raw + "\n```";
    expect(stripHiddenBlocks(fenced)).toBe(fenced);
  });
});
