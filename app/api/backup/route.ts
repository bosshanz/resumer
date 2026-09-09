import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { exportBackup, restoreBackup } from "@/lib/backup";
import { BackupError, MAX_BACKUP_BYTES } from "@/lib/backup-format";

export const runtime = "nodejs";

function failure(error: unknown) {
  if (error instanceof BackupError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Backup failed", error);
  return NextResponse.json({ error: "备份操作失败，请重试" }, { status: 500 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const json = JSON.stringify(exportBackup(getDatabase(), session.user.id));
    if (Buffer.byteLength(json) > MAX_BACKUP_BYTES) {
      throw new BackupError("备份超过 100 MB，暂不支持通过网页导出，请使用 SQLite 备份", 413);
    }
    return new Response(json, { headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="resumer-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    } });
  } catch (error) { return failure(error); }
}

async function readBackup(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BACKUP_BYTES) {
    throw new BackupError("备份文件不能超过 100 MB", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new BackupError("请选择备份文件");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BACKUP_BYTES) {
        await reader.cancel();
        throw new BackupError("备份文件不能超过 100 MB", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new BackupError("文件不是有效的 JSON 备份"); }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const backup = await readBackup(request);
    const restored = restoreBackup(getDatabase(), session.user.id, backup);
    return NextResponse.json({ restored }, { status: 201 });
  } catch (error) { return failure(error); }
}
