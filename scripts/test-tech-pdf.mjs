import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { register } = require("tsx/cjs/api");
const unregister = register();
const { generateResumePdf } = require("../lib/pdf.ts");
const { defaultResumeContent } = require("../lib/types.ts");

async function main() {
  const pdf = await generateResumePdf(defaultResumeContent, "tech", {});
  const outputPath = path.join(os.tmpdir(), "tech-resume.pdf");
  fs.writeFileSync(outputPath, pdf);
  console.log("PDF generated:", pdf.length, "bytes", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  unregister();
});
