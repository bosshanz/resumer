import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDatabase, initDb } from "@/lib/db";
import { normalizeResume } from "@/lib/resumes";
import {
  createResumeVersion,
  getResumeVersion,
} from "@/lib/resume-versions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

initDb();
const db = getDatabase();

// 恢复 = 先把被替换的当前状态留档（恢复错了还能退回来），再整体回到所选快照
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, versionId } = await params;
  const current = db
    .prepare(`SELECT * FROM resumes WHERE id = ? AND user_id = ?`)
    .get(id, session.user.id) as Record<string, unknown> | undefined;
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const version = getResumeVersion(db, id, versionId);
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const restore = db.transaction(() => {
    createResumeVersion(db, {
      resumeId: id,
      userId: session.user.id!,
      title: String(current.title ?? ""),
      content: String(current.content ?? ""),
      templateId: String(current.template_id ?? "minimal"),
      themeVariables: String(current.theme_variables ?? "{}"),
      photo: current.photo ? String(current.photo) : null,
    });
    db.prepare(
      `UPDATE resumes
       SET title = ?, content = ?, template_id = ?, theme_variables = ?, photo = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      version.title,
      version.content,
      version.templateId,
      version.themeVariables,
      version.photo,
      id
    );
  });
  restore();

  const resume = db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(id) as Record<string, unknown>;
  return NextResponse.json({ resume: normalizeResume(resume) });
}
