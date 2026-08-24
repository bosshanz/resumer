import React from "react";
import puppeteer from "puppeteer-core";
import type { Browser, Page } from "puppeteer-core";
import { parseResumeContent } from "./parser";
import { getTemplate } from "./templates";
import { readResumeTemplateCss } from "./templates/css";
import { ThemeVariables } from "./types";
import { buildPdfChrome, buildPdfPageCss } from "./pdf-chrome";

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

// 复用浏览器实例，连续导出时省去每次约 1s 的冷启动；空闲一段时间后自动关闭，
// 避免常驻进程。unref 保证定时器不会阻止脚本进程退出。
const BROWSER_IDLE_CLOSE_MS = 30_000;

let browserPromise: Promise<Browser> | null = null;
let browserIdleTimer: NodeJS.Timeout | null = null;

async function closeBrowser() {
  const closing = browserPromise;
  browserPromise = null;
  if (!closing) return;
  try {
    await (await closing).close();
  } catch {
    // 浏览器可能已退出
  }
}

function scheduleBrowserClose() {
  if (browserIdleTimer) clearTimeout(browserIdleTimer);
  browserIdleTimer = setTimeout(() => {
    browserIdleTimer = null;
    void closeBrowser();
  }, BROWSER_IDLE_CLOSE_MS);
  browserIdleTimer.unref();
}

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const promise = puppeteer.launch({
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
    browserPromise = promise;
    promise.catch(() => {
      // 启动失败时清空引用，下次导出可以重试
      if (browserPromise === promise) browserPromise = null;
    });
  }
  scheduleBrowserClose();
  return browserPromise;
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

  // Zero @page margin so the paper color and first-page bleeds fill the A4
  // sheet. Inset comes from .resume-page padding (same as the on-screen
  // preview). Chrome clips overflow into @page margins, so a non-zero
  // margin would leave a white frame around the resume.
  const pageCss = buildPdfPageCss(mergedTheme);

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
  const { frontmatter } = parseResumeContent(content);
  const template = getTemplate(templateId) || getTemplate("minimal")!;
  const mergedTheme = { ...template.defaultTheme, ...themeVariables };
  const chrome = buildPdfChrome(frontmatter, mergedTheme);

  let page: Page;
  try {
    page = await (await getBrowser()).newPage();
  } catch {
    // 复用的实例可能已崩溃或被关闭，重置后重试一次
    await closeBrowser();
    page = await (await getBrowser()).newPage();
  }

  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: chrome.headerTemplate,
      footerTemplate: chrome.footerTemplate,
    });

    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
    scheduleBrowserClose();
  }
}
