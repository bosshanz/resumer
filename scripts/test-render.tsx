import React from "react";
import { renderToString } from "react-dom/server";
import { defaultResumeContent } from "../lib/types.ts";
import { parseResumeContent } from "../lib/parser.ts";
import { templates } from "../lib/templates/index.ts";
import type { TemplateProps } from "../lib/templates/base.tsx";

const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='280'><rect width='100%' height='100%' fill='#8a7a6a'/><circle cx='100' cy='110' r='42' fill='#d8c8b0'/></svg>`
  );

const { frontmatter, body } = parseResumeContent(defaultResumeContent);

let fail = 0;
for (const template of templates) {
  try {
    const Component = template.component as React.FC<TemplateProps>;
    const html = renderToString(
      React.createElement(Component, { frontmatter, body, themeVariables: {}, photo: PHOTO })
    );
    const hasPhoto = html.includes("resume-photo");
    console.log(`✓ ${template.id.padEnd(10)} render=${html.length}b  photo=${hasPhoto}`);
  } catch (e) {
    fail++;
    console.error(`✗ ${template.id} threw:`, e);
  }
}
console.log(fail === 0 ? "\nALL OK" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
