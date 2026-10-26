import fs from "node:fs";
import path from "node:path";

// PDF 导出的 HTML 是独立文档（page.setContent），拿不到应用页面上由 next/font
// 注入的 @font-face。这里从 .next 构建产物里抽取这些声明，把 woff2 内联成
// base64，让导出与浏览器预览渲染同一套真实字体。抽取失败（无 .next 产物）
// 时返回 null，模板字体栈会自然回落到本地系统字体。

const FONT_FACE_RE = /@font-face\s*\{[^}]*\}/g;
// 仅匹配 next/font 生成的字体变量（值一定是带引号的字体族列表）
const FONT_VAR_RE = /--font-[a-z0-9-]+\s*:\s*"[^"]+"\s*(,\s*"[^"]+"\s*)*;/g;
const WOFF_URL_RE = /url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/;
const FAMILY_RE = /font-family:\s*([^;]+);/;

interface EmbeddedFace {
  /** @font-face 原文，woff2 地址替换成占位符 */
  block: string;
  woffPath: string | null;
  /** 没有 unicode-range 的字体面恒为 null，表示总是需要 */
  ranges: Array<[number, number]> | null;
}

interface EmbeddedFonts {
  faces: EmbeddedFace[];
  varCss: string;
}

const WOFF_PLACEHOLDER = "__RESUMER_WOFF2__";
const UNICODE_RANGE_RE = /unicode-range:\s*([^;}]+)/;

let cached: EmbeddedFonts | null = null;
let resolved = false;
const base64Cache = new Map<string, string | null>();

function collectCssFiles(dir: string, files: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectCssFiles(full, files);
    else if (entry.isFile() && entry.name.endsWith(".css")) files.push(full);
  }
  return files;
}

function readTextSafe(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf-8");
  } catch {
    return null;
  }
}

export function parseUnicodeRange(value: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const raw of value.split(",")) {
    const part = raw.trim().replace(/^u\+/i, "");
    if (!part) continue;
    if (part.includes("?")) {
      const lo = parseInt(part.replace(/\?/g, "0"), 16);
      const hi = parseInt(part.replace(/\?/g, "F"), 16);
      if (Number.isFinite(lo) && Number.isFinite(hi)) ranges.push([lo, hi]);
      continue;
    }
    const [start, end] = part.split("-");
    const lo = parseInt(start, 16);
    const hi = end ? parseInt(end, 16) : lo;
    if (Number.isFinite(lo) && Number.isFinite(hi)) ranges.push([lo, hi]);
  }
  return ranges;
}

function readBase64(file: string): string | null {
  if (!base64Cache.has(file)) {
    try {
      base64Cache.set(file, fs.readFileSync(file).toString("base64"));
    } catch {
      base64Cache.set(file, null);
    }
  }
  return base64Cache.get(file) ?? null;
}

function resolveFonts(nextDir: string): EmbeddedFonts | null {
  // 生产构建的字体在 .next/static，dev 构建在 .next/dev/static；避免遍历 .next/cache。
  const cssDirs = [path.join(nextDir, "static"), path.join(nextDir, "dev", "static")];
  const cssFiles = cssDirs.flatMap((dir) => collectCssFiles(dir));

  const varDeclarations: string[] = [];
  const usedFamilies = new Set<string>();
  for (const file of cssFiles) {
    const text = readTextSafe(file);
    if (!text) continue;
    for (const match of text.matchAll(FONT_VAR_RE)) {
      if (!varDeclarations.includes(match[0])) varDeclarations.push(match[0]);
      for (const family of match[0].matchAll(/"([^"]+)"/g)) usedFamilies.add(family[1]);
    }
  }
  if (varDeclarations.length === 0) return null;

  const faces: EmbeddedFace[] = [];
  const seen = new Set<string>();
  for (const file of cssFiles) {
    const text = readTextSafe(file);
    if (!text) continue;
    for (const match of text.matchAll(FONT_FACE_RE)) {
      const familyMatch = FAMILY_RE.exec(match[0]);
      const family = familyMatch ? familyMatch[1].trim().replace(/^["']|["']$/g, "") : "";
      if (!usedFamilies.has(family)) continue; // 应用 UI 专用字体不进简历
      const url = WOFF_URL_RE.exec(match[0]);
      const woffPath = url ? path.resolve(path.dirname(file), url[1]) : null;
      if (woffPath && !fs.existsSync(woffPath)) continue;
      const block = url ? match[0].replace(url[0], `url(${WOFF_PLACEHOLDER})`) : match[0];
      const key = block;
      if (seen.has(key)) continue;
      seen.add(key);
      const range = UNICODE_RANGE_RE.exec(block);
      faces.push({ block, woffPath, ranges: range ? parseUnicodeRange(range[1]) : null });
    }
  }
  if (faces.length === 0) return null;

  return {
    faces,
    // 字体变量挂在 .resume-page 上（与 base.css 的默认值同优先级，
    // 本块在模板样式之后注入，可覆盖 .next 中实际生成的字体族名）。
    varCss: `.resume-page {\n  ${varDeclarations.join("\n  ")}\n}`,
  };
}

function codepointsOf(text: string): Set<number> {
  const points = new Set<number>();
  for (const char of text) points.add(char.codePointAt(0)!);
  return points;
}

function faceNeeded(face: EmbeddedFace, points: Set<number> | null): boolean {
  if (!points || !face.ranges) return true;
  for (const [lo, hi] of face.ranges) {
    if (hi - lo < points.size) {
      for (let cp = lo; cp <= hi; cp += 1) if (points.has(cp)) return true;
    } else {
      for (const cp of points) if (cp >= lo && cp <= hi) return true;
    }
  }
  return false;
}

/**
 * 返回内嵌字体 CSS。传入 text 时只内嵌 unicode-range 覆盖到这些字符的
 * 字体切片：中文字体按 Google Fonts 的切片拆成上百个文件，整套内嵌太大。
 */
export function loadEmbeddedFontCss(
  nextDir: string = path.join(process.cwd(), ".next"),
  text?: string
): string | null {
  if (!resolved) {
    resolved = true;
    cached = resolveFonts(nextDir);
  }
  if (!cached) return null;
  const points = text === undefined ? null : codepointsOf(text);
  const faces: string[] = [];
  for (const face of cached.faces) {
    if (!faceNeeded(face, points)) continue;
    if (!face.woffPath) {
      faces.push(face.block); // local() 回退字体，原样保留
      continue;
    }
    const data = readBase64(face.woffPath);
    if (!data) continue;
    faces.push(face.block.replace(WOFF_PLACEHOLDER, `data:font/woff2;base64,${data}`));
  }
  if (faces.length === 0) return null;
  return [...faces, cached.varCss].join("\n\n");
}

// 仅供测试：清空模块级缓存
export function resetEmbeddedFontCacheForTest(): void {
  cached = null;
  resolved = false;
  base64Cache.clear();
}
