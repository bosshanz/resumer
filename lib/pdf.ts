import React from "react";
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { parseResumeContent } from "./parser";
import { getTemplate } from "./templates";
import { ThemeVariables } from "./types";

function getExecutablePath(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  return "/usr/bin/chromium";
}

export async function renderResumeHtml(
  content: string,
  templateId: string,
  themeVariables: ThemeVariables,
  photo?: string
): Promise<string> {
  const { renderToString } = await import("react-dom/server");

  const { frontmatter, body } = parseResumeContent(content);
  const template = getTemplate(templateId) || getTemplate("minimal")!;
  const mergedTheme = { ...template.defaultTheme, ...themeVariables };

  const Component = template.component;
  const element = React.createElement(Component, {
    frontmatter,
    body,
    themeVariables: mergedTheme,
    photo,
  });

  const bodyHtml = renderToString(element);

  const cssPath = path.join(/*turbopackIgnore: true*/ process.cwd(), "lib", "templates", "styles.css");
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf-8") : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${css}</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

export async function generateResumePdf(
  content: string,
  templateId: string,
  themeVariables: ThemeVariables,
  photo?: string
): Promise<Buffer> {
  const html = await renderResumeHtml(content, templateId, themeVariables, photo);
  const browser = await puppeteer.launch({
    executablePath: getExecutablePath(),
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
