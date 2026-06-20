import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDatabase, initDb } from "@/lib/db";
import { themeVariablesSchema } from "@/lib/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

initDb();
const db = getDatabase();

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  templateId: z.string().min(1).optional(),
  themeVariables: themeVariablesSchema.optional(),
  photo: z.string().optional(),
});

async function getResumeForUser(resumeId: string, userId: string) {
  return db
    .prepare(`SELECT * FROM resumes WHERE id = ? AND user_id = ?`)
    .get(resumeId, userId) as Record<string, unknown> | undefined;
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const resume = await getResumeForUser(id, session.user.id);
  if (!resume) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ resume: normalizeResume(resume) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getResumeForUser(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (parsed.data.title !== undefined) {
    updates.push("title = ?");
    values.push(parsed.data.title);
  }
  if (parsed.data.content !== undefined) {
    updates.push("content = ?");
    values.push(parsed.data.content);
  }
  if (parsed.data.templateId !== undefined) {
    updates.push("template_id = ?");
    values.push(parsed.data.templateId);
  }
  if (parsed.data.themeVariables !== undefined) {
    updates.push("theme_variables = ?");
    values.push(JSON.stringify(parsed.data.themeVariables));
  }
  if (parsed.data.photo !== undefined) {
    updates.push("photo = ?");
    values.push(parsed.data.photo);
  }

  if (updates.length === 0) {
    return NextResponse.json({ resume: normalizeResume(existing) });
  }

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE resumes SET ${updates.join(", ")} WHERE id = ?`).run(...values);

  const resume = db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(id) as Record<string, unknown>;
  return NextResponse.json({ resume: normalizeResume(resume) });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getResumeForUser(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.prepare(`DELETE FROM resumes WHERE id = ?`).run(id);
  return NextResponse.json({ success: true });
}
