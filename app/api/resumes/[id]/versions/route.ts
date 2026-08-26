import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDatabase, initDb } from "@/lib/db";
import { listResumeVersions, versionContentPreview } from "@/lib/resume-versions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

initDb();
const db = getDatabase();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const owned = db
    .prepare(`SELECT id FROM resumes WHERE id = ? AND user_id = ?`)
    .get(id, session.user.id);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const versions = listResumeVersions(db, id).map((version) => ({
    id: version.id,
    title: version.title,
    createdAt: version.createdAt,
    contentPreview: versionContentPreview(version.content),
  }));

  return NextResponse.json({ versions });
}
