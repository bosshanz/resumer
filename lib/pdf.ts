import React from "react";
import puppeteer from "puppeteer-core";
import { parseResumeContent } from "./parser";
import { getTemplate } from "./templates";
import { readResumeTemplateCss } from "./templates/css";
import { ThemeVariables } from "./types";

const pdfFontVariablesCss = `
  :root {
    --font-geist-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --font-geist-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    --font-fraunces: "Iowan Old Style", Georgia, serif;
    --font-plex-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --font-plex-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    --font-inter-tight: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
`;

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

  const css = readResumeTemplateCss();

  // Use @page margins so every page (including page 2+) keeps the same top spacing.
  // The .resume-page padding is only needed for on-screen preview and must be
  // removed for print to avoid double margins.
  // Exception: the tech template has a first-page banner that uses negative
  // margin-top to bleed into the page top. Only page 1 gets a zero top margin;
  // later pages must keep the configured top margin.
  const isTech = templateId === "tech";
  const marginTop = mergedTheme.marginTop || "16mm";
  const pageCss = `
    @page {
      size: A4;
      margin-top: ${marginTop};
      margin-bottom: ${mergedTheme.marginBottom || "16mm"};
      margin-left: ${mergedTheme.marginLeft || "20mm"};
      margin-right: ${mergedTheme.marginRight || "20mm"};
    }
    ${isTech ? "@page:first { margin-top: 0; }" : ""}
    @media print {
      .resume-page {
        width: auto !important;
        min-height: 0 !important;
        padding-bottom: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        ${isTech ? "" : "padding-top: 0 !important;"}
      }
    }
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${pdfFontVariablesCss}</style>
  <style>${css}</style>
  <style>${pageCss}</style>
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
