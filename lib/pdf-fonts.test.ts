import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEmbeddedFontCss, resetEmbeddedFontCacheForTest } from "./pdf-fonts";

function buildFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resumer-next-"));
  fs.mkdirSync(path.join(root, "static", "chunks"), { recursive: true });
  fs.mkdirSync(path.join(root, "static", "media"), { recursive: true });
  const woff = Buffer.from([0x77, 0x4f, 0x46, 0x32, 0x00, 0x01]);
  fs.writeFileSync(path.join(root, "static", "media", "fake.woff2"), woff);
  fs.writeFileSync(
    path.join(root, "static", "chunks", "font.css"),
    `@font-face {
  font-family: Fraunces;
  font-style: normal;
  font-weight: 100 900;
  src: url("../media/fake.woff2") format("woff2");
}
@font-face {
  font-family: Fraunces Fallback;
  src: local("Times New Roman");
  ascent-override: 84.71%;
}
.demo-module__variable {
  --font-fraunces: "Fraunces", "Fraunces Fallback";
}
@font-face {
  font-family: Unrelated;
  src: local("Arial");
}
`
  );
  return root;
}

afterEach(() => {
  resetEmbeddedFontCacheForTest();
});

describe("loadEmbeddedFontCss", () => {
  it("inlines woff2 as base64 data URI and re-declares font vars on .resume-page", () => {
    const css = loadEmbeddedFontCss(buildFixture());
    expect(css).toBeTruthy();
    expect(css!).toContain('font-family: Fraunces;');
    expect(css!).toContain(`url(data:font/woff2;base64,${woff_b64()})`);
    expect(css!).toContain("@font-face"); // local() 回退字体保留
    expect(css!).toContain('.resume-page {');
    expect(css!).toContain('--font-fraunces: "Fraunces", "Fraunces Fallback";');
    // 应用 UI 专用字体（未出现在字体变量中）不注入
    expect(css!).not.toContain("Unrelated");
  });

  it("returns the same cached result on the second call", () => {
    const root = buildFixture();
    const first = loadEmbeddedFontCss(root);
    const second = loadEmbeddedFontCss(root);
    expect(second).toBe(first);
  });

  it("returns null when the .next directory has no font artifacts", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "resumer-empty-"));
    expect(loadEmbeddedFontCss(empty)).toBeNull();
  });
});

function woff_b64(): string {
  const woff = Buffer.from([0x77, 0x4f, 0x46, 0x32, 0x00, 0x01]);
  return woff.toString("base64");
}
