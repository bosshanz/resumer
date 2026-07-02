import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { register } = require("tsx/cjs/api");
const unregister = register();
const { generateResumePdf } = require("../lib/pdf.ts");
const { defaultResumeContent } = require("../lib/types.ts");
const { templates } = require("../lib/templates");

const outputDir = path.join(os.tmpdir(), "resumer-pdfs");
const templateIds = templates.map((template) => template.id);

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const t of templateIds) {
    const pdf = await generateResumePdf(defaultResumeContent, t, {});
    const outputPath = path.join(outputDir, `${t}-resume.pdf`);
    fs.writeFileSync(outputPath, pdf);
    console.log(t, pdf.length, outputPath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  unregister();
});
