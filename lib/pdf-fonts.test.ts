import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEmbeddedFontCss, parseUnicodeRange, resetEmbeddedFontCacheForTest } from "./pdf-fonts";

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

function buildSlicedFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resumer-sliced-"));
  fs.mkdirSync(path.join(root, "static", "chunks"), { recursive: true });
  fs.mkdirSync(path.join(root, "static", "media"), { recursive: true });
  for (const name of ["latin", "cjk-a", "cjk-b"]) {
    fs.writeFileSync(path.join(root, "static", "media", `${name}.woff2`), Buffer.from(name));
  }
  const face = (file: string, range: string) => `@font-face {
  font-family: Noto Sans SC;
  font-weight: 100 900;
  src: url("../media/${file}.woff2") format("woff2");
  unicode-range: ${range};
}`;
  fs.writeFileSync(
    path.join(root, "static", "chunks", "font.css"),
    [
      face("latin", "U+0000-00FF, U+2000-206F"),
      face("cjk-a", "U+4E00-4E8F, U+9648"),
      face("cjk-b", "U+5B89, U+FF08-FF09"),
      `.x { --font-noto-sans-sc: "Noto Sans SC", "Noto Sans SC Fallback"; }`,
    ].join("\n"),
  );
  return root;
}

describe("unicode-range slicing", () => {
  it("parses single points, ranges and wildcards", () => {
    expect(parseUnicodeRange("U+0025-00FF, u+4??, U+9648")).toEqual([
      [0x25, 0xff],
      [0x400, 0x4ff],
      [0x9648, 0x9648],
    ]);
  });

  it("embeds only the slices whose ranges cover the document text", () => {
    const root = buildSlicedFixture();
    const b64 = (name: string) => Buffer.from(name).toString("base64");
    const css = loadEmbeddedFontCss(root, "陈 Agent")!;
    expect(css).toContain(b64("latin"));
    expect(css).toContain(b64("cjk-a")); // 陈 = U+9648
    expect(css).not.toContain(b64("cjk-b"));
    // 「（续）」标签由分页脚本插入，PDF 端需要把它算进文本
    expect(loadEmbeddedFontCss(root, "安（续）")!).toContain(b64("cjk-b"));
    expect(loadEmbeddedFontCss(root)!).toContain(b64("cjk-b"));
  });
});

function woff_b64(): string {
  const woff = Buffer.from([0x77, 0x4f, 0x46, 0x32, 0x00, 0x01]);
  return woff.toString("base64");
}
