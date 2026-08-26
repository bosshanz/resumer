import React from "react";
import { renderToString } from "react-dom/server";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";
import { defaultResumeContent } from "../lib/types";
import { parseResumeContent } from "../lib/parser";
import { templates } from "../lib/templates/index";
import { readResumeTemplateCss } from "../lib/templates/css";
import { loadEmbeddedFontCss } from "../lib/pdf-fonts";
import type { TemplateProps } from "../lib/templates/base";

const OUT_DIR = "/tmp/resumer-design-review";

const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='280'><rect width='100%' height='100%' fill='#8a7a6a'/><circle cx='100' cy='110' r='42' fill='#d8c8b0'/></svg>`
  );

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const css = readResumeTemplateCss();
  const { frontmatter, body } = parseResumeContent(defaultResumeContent);

  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

  for (const template of templates) {
    try {
      const Component = template.component as React.FC<TemplateProps>;
      const inner = renderToString(
        React.createElement(Component, { frontmatter, body, themeVariables: {}, photo: PHOTO })
      );
      const html = `<!doctype html><html><head><meta charset="utf-8">
      <style>body{margin:0;background:#e5e5e5;display:flex;justify-content:center;padding:24px 0}
      .resume-page{box-shadow:0 2px 24px rgba(0,0,0,.18)}</style>
      <style>${css}</style>
      <style>${loadEmbeddedFontCss() ?? ""}</style></head><body>${inner}</body></html>`;
      await page.setContent(html, { waitUntil: "load", timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);
      await new Promise((r) => setTimeout(r, 300));
      const el = await page.$(".resume-page");
      const outFile = path.join(OUT_DIR, `${template.id}.png`);
      if (el) {
        await el.screenshot({ path: outFile });
        console.log(`OK ${template.id} -> ${outFile}`);
      } else {
        console.error(`FAIL ${template.id}: no .resume-page`);
      }
    } catch (e) {
      console.error(`FAIL ${template.id}: ${String(e).slice(0, 120)}`);
    }
  }

  await browser.close();
  console.log("DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
