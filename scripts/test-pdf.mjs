import { generateResumePdf } from "../lib/pdf.ts";
import { defaultResumeContent } from "../lib/types.ts";
import fs from "fs";

process.env.PUPPETEER_EXECUTABLE_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function main() {
  const pdf = await generateResumePdf(defaultResumeContent, "minimal", {});
  fs.writeFileSync("test-resume.pdf", pdf);
  console.log("PDF generated:", pdf.length, "bytes");
}

main().catch(console.error);
