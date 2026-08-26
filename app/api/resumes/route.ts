import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDatabase, initDb } from "@/lib/db";
import { normalizeResume } from "@/lib/resumes";
import { defaultResumeContent } from "@/lib/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";

export const runtime = "nodejs";

initDb();
const db = getDatabase();

const createSchema = z.object({
  sourceResumeId: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resumes = db
    .prepare(
      `SELECT id, title, template_id as templateId, updated_at as updatedAt,
              parent_id as parentId, origin_note as originNote
       FROM resumes WHERE user_id = ? ORDER BY updated_at DESC`
    )
    .all(session.user.id) as { id: string; title: string; templateId: string; updatedAt: string; parentId?: string; originNote?: string }[];

  return NextResponse.json({ resumes });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is acceptable for creating a blank resume.
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  let title = "未命名简历";
  let content = defaultResumeContent;
  let templateId = "minimal";
  let themeVariables = JSON.stringify({});
  let photo: string | null = null;
  let parentId: string | null = null;

  if (parsed.data.sourceResumeId) {
    const source = db
      .prepare(`SELECT * FROM resumes WHERE id = ? AND user_id = ?`)
      .get(parsed.data.sourceResumeId, session.user.id) as Record<string, unknown> | undefined;

    if (!source) {
      return NextResponse.json({ error: "Source resume not found" }, { status: 404 });
    }

    const sourceTitle = String(source.title || "未命名简历");
    title = `${sourceTitle} - 副本`;
    content = String(source.content);
    templateId = String(source.template_id);
    themeVariables = String(source.theme_variables);
    photo = source.photo ? String(source.photo) : null;
    // 复制视为手动分叉：与被复制简历（及其母本下的所有变体）归到同一组
    parentId = source.parent_id ? String(source.parent_id) : String(parsed.data.sourceResumeId);
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO resumes (id, user_id, title, content, template_id, theme_variables, photo, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, session.user.id, title, content, templateId, themeVariables, photo, parentId);

  const resume = db
    .prepare(`SELECT * FROM resumes WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;

  return NextResponse.json({ resume: normalizeResume(resume) }, { status: 201 });
}
