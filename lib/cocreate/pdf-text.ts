import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";

export const MAX_PDF_BYTES = 5 * 1024 * 1024;

export class PdfTextError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "PdfTextError";
  }
}

/** 整理 pdftotext 输出：去掉分页符、行尾空白和多余空行 */
export function tidyPdfText(raw: string): string {
  return raw
    .replace(/\f/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 用 poppler 的 pdftotext 抽取文字；只读文本层，扫描件会得到空文本 */
export async function extractPdfText(data: Buffer): Promise<string> {
  if (data.length === 0) throw new PdfTextError("文件是空的", 400);
  if (data.length > MAX_PDF_BYTES) throw new PdfTextError("PDF 不能超过 5 MB", 413);
  if (data.subarray(0, 5).toString("latin1") !== "%PDF-") throw new PdfTextError("这不是 PDF 文件", 400);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "resumer-pdf-"));
  const file = path.join(dir, `${crypto.randomUUID()}.pdf`);
  try {
    await fs.writeFile(file, data);
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        "pdftotext",
        ["-enc", "UTF-8", "-nopgbrk", file, "-"],
        { timeout: 15000, maxBuffer: 4 * 1024 * 1024 },
        (error, out) => {
          if (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
              reject(new PdfTextError("服务器没有安装 pdftotext，请直接粘贴简历文字", 501));
            } else {
              reject(new PdfTextError("读取 PDF 失败，请直接粘贴简历文字", 422));
            }
            return;
          }
          resolve(out);
        }
      );
    });
    const text = tidyPdfText(stdout);
    if (!text) throw new PdfTextError("没有读到文字（可能是扫描件），请直接粘贴简历文字", 422);
    return text;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
