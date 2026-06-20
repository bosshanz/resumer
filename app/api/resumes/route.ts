import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDatabase, initDb } from "@/lib/db";
import { defaultResumeContent } from "@/lib/types";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

initDb();
const db = getDatabase();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resumes = db
    .prepare(
      `SELECT id, title, template_id as templateId, updated_at as updatedAt FROM resumes WHERE user_id = ? ORDER BY updated_at DESC`
    )
    .all(session.user.id) as { id: string; title: string; templateId: string; updatedAt: string }[];

  return NextResponse.json({ resumes });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO resumes (id, user_id, title, content, template_id, theme_variables) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, session.user.id, "未命名简历", defaultResumeContent, "minimal", JSON.stringify({}));

  const resume = db
    .prepare(`SELECT * FROM resumes WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;

  return NextResponse.json({ resume: normalizeResume(resume) }, { status: 201 });
}

function normalizeResume(row: Record<string, unknown> | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    templateId: row.template_id,
    themeVariables: JSON.parse(String(row.theme_variables || "{}")),
    photo: row.photo ? String(row.photo) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
