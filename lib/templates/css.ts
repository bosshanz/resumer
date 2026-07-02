import fs from "fs";
import path from "path";

export const resumeTemplateStyleFiles = [
  "base.css",
  "modern-header.css",
  "minimal.css",
  "tech.css",
  "developer.css",
  "grid.css",
  "editorial.css",
  "executive.css",
  "compact.css",
] as const;

export function readResumeTemplateCss(): string {
  const stylesDir = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "lib",
    "templates",
    "styles"
  );

  return resumeTemplateStyleFiles
    .map((file) => {
      const cssPath = path.join(stylesDir, file);
      return fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf-8") : "";
    })
    .filter(Boolean)
    .join("\n\n");
}
