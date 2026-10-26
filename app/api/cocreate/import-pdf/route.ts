import { NextResponse } from "next/server";
import { requireUserId, unauthorized } from "@/lib/cocreate/http";
import { extractPdfText, MAX_PDF_BYTES, PdfTextError } from "@/lib/cocreate/pdf-text";
import { MAX_IMPORT_CHARS } from "@/lib/cocreate/skill";

export const runtime = "nodejs";

/** 把旧简历 PDF 转成文字，交给用户确认后再作为“导入”发给 AI */
export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "请上传 PDF 文件" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "请上传 PDF 文件" }, { status: 400 });
  if (file.size > MAX_PDF_BYTES) return NextResponse.json({ error: "PDF 不能超过 5 MB" }, { status: 413 });
  try {
    const text = await extractPdfText(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ text: text.slice(0, MAX_IMPORT_CHARS), truncated: text.length > MAX_IMPORT_CHARS });
  } catch (error) {
    if (error instanceof PdfTextError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[cocreate:import-pdf]", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "读取 PDF 失败，请直接粘贴简历文字" }, { status: 500 });
  }
}
