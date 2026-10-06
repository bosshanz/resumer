import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { resolvePhoto } from "@/lib/photos";
import { parseThemeVariables } from "@/lib/resumes";
import { getResumeVersion } from "@/lib/resume-versions";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, versionId } = await params;
  const db = getDatabase();
  const owned = db.prepare("SELECT id FROM resumes WHERE id = ? AND user_id = ?")
    .get(id, session.user.id);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const version = getResumeVersion(db, id, versionId);
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  return NextResponse.json({
    version: {
      id: version.id,
      title: version.title,
      content: version.content,
      templateId: version.templateId,
      themeVariables: parseThemeVariables(version.themeVariables),
      photo: resolvePhoto(db, version.photo),
      createdAt: version.createdAt,
    },
  });
}
