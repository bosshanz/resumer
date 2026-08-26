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

let cachedCss: string | null = null;
let resolved = false;

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

function inlineWoffUrls(block: string, cssFile: string): string | null {
  const match = WOFF_URL_RE.exec(block);
  if (!match) return block; // local() 回退字体，原样保留
  const woffPath = path.resolve(path.dirname(cssFile), match[1]);
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(woffPath);
  } catch {
    return null;
  }
  return block.replace(match[0], `url(data:font/woff2;base64,${bytes.toString("base64")})`);
}

export function loadEmbeddedFontCss(nextDir: string = path.join(process.cwd(), ".next")): string | null {
  if (resolved) return cachedCss;
  resolved = true;

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

  const faces: string[] = [];
  const seen = new Set<string>();
  for (const file of cssFiles) {
    const text = readTextSafe(file);
    if (!text) continue;
    for (const match of text.matchAll(FONT_FACE_RE)) {
      const block = inlineWoffUrls(match[0], file);
      if (!block) continue;
      const familyMatch = FAMILY_RE.exec(block);
      const family = familyMatch ? familyMatch[1].trim().replace(/^["']|["']$/g, "") : "";
      if (!usedFamilies.has(family)) continue; // 应用 UI 专用字体不进简历
      const key = block.replace(/url\(data:font\/woff2;base64,[^)]+\)/, "url(data)");
      if (seen.has(key)) continue;
      seen.add(key);
      faces.push(block);
    }
  }
  if (faces.length === 0) return null;

  cachedCss = [
    ...faces,
    // 字体变量挂在 .resume-page 上（与 base.css 的默认值同优先级，
    // 本块在模板样式之后注入，可覆盖 .next 中实际生成的字体族名）。
    `.resume-page {\n  ${varDeclarations.join("\n  ")}\n}`,
  ].join("\n\n");
  return cachedCss;
}

// 仅供测试：清空模块级缓存
export function resetEmbeddedFontCacheForTest(): void {
  cachedCss = null;
  resolved = false;
}
