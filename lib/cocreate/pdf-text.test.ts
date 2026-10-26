import { describe, expect, it } from "vitest";
import { extractPdfText, tidyPdfText } from "./pdf-text";

describe("PDF 文字整理", () => {
  it("去分页符、行尾空白和多余空行", () => {
    expect(tidyPdfText("王雨  \n\n\n\n美团\f复旦大学\n")).toBe("王雨\n\n美团\n复旦大学");
  });

  it("拒绝空文件和非 PDF", async () => {
    await expect(extractPdfText(Buffer.alloc(0))).rejects.toThrow("文件是空的");
    await expect(extractPdfText(Buffer.from("hello"))).rejects.toThrow("这不是 PDF 文件");
  });
});
