import { renderToString } from "react-dom/server";
import { defaultResumeContent } from "../lib/types.ts";
import { parseResumeContent } from "../lib/parser.ts";
import { MinimalTemplate } from "../lib/templates/minimal.tsx";
import { TechTemplate } from "../lib/templates/tech.tsx";
import { DeveloperTemplate } from "../lib/templates/developer.tsx";
import { GridTemplate } from "../lib/templates/grid.tsx";
import { EditorialTemplate } from "../lib/templates/editorial.tsx";

const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='280'><rect width='100%' height='100%' fill='#8a7a6a'/><circle cx='100' cy='110' r='42' fill='#d8c8b0'/></svg>`
  );

const { frontmatter, body } = parseResumeContent(defaultResumeContent);
const templates = [
  ["minimal", MinimalTemplate],
  ["tech", TechTemplate],
  ["developer", DeveloperTemplate],
  ["grid", GridTemplate],
  ["editorial", EditorialTemplate],
] as const;

let fail = 0;
for (const [id, Cmp] of templates) {
  try {
    const html = renderToString(
      // @ts-expect-error union of component types is fine for a render probe
      <Cmp frontmatter={frontmatter} body={body} themeVariables={{}} photo={PHOTO} />
    );
    const hasPhoto = html.includes("resume-photo");
    console.log(`✓ ${id.padEnd(10)} render=${html.length}b  photo=${hasPhoto}`);
  } catch (e) {
    fail++;
    console.error(`✗ ${id} threw:`, e);
  }
}
console.log(fail === 0 ? "\nALL OK" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
