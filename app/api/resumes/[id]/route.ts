import { getServerSession } from "next-auth/next";
import type Database from "better-sqlite3";
import { authOptions } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { deleteRewriteSessionsForResume } from "@/lib/rewrite/sessions";
import { normalizeResume } from "@/lib/resumes";
import { photoRef, pruneOrphanPhotos, resolveResumePhoto } from "@/lib/photos";
import { deleteResumeVersionsForResume, snapshotIfDue } from "@/lib/resume-versions";
import { themeVariablesSchema } from "@/lib/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  templateId: z.string().min(1).optional(),
  themeVariables: themeVariablesSchema.optional(),
  photo: z.string().optional(),
  // 手动保存（Cmd/Ctrl+S）传 true：跳过快照间隔限制，立即留档
  snapshot: z.boolean().optional(),
});

async function getResumeForUser(db: Database.Database, resumeId: string, userId: string) {
  return db
    .prepare(`SELECT * FROM resumes WHERE id = ? AND user_id = ?`)
    .get(resumeId, userId) as Record<string, unknown> | undefined;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDatabase();

  const { id } = await params;
  const resume = await getResumeForUser(db, id, session.user.id);
  if (!resume) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ resume: resolveResumePhoto(db, normalizeResume(resume)) });
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
  const db = getDatabase();
  const existing = await getResumeForUser(db, id, session.user.id);
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

  const resume = db.transaction(() => {
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
      // 空串表示清除照片；否则转成内容寻址引用，历史快照可共享同一份存储
      values.push(parsed.data.photo ? photoRef(db, parsed.data.photo) : null);
    }

    if (updates.length === 0 && !parsed.data.snapshot) {
      return resolveResumePhoto(db, normalizeResume(existing));
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE resumes SET ${updates.join(", ")} WHERE id = ?`).run(...values);

    const resume = db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(id) as Record<string, unknown>;
    snapshotIfDue(db, {
      resumeId: id,
      userId: session.user.id!,
      manual: parsed.data.snapshot === true,
      title: String(resume.title ?? ""),
      content: String(resume.content ?? ""),
      templateId: String(resume.template_id ?? "minimal"),
      themeVariables: String(resume.theme_variables ?? "{}"),
      photo: resume.photo ? String(resume.photo) : null,
    });
    // 替换照片或裁剪快照都可能移除最后一个引用。
    pruneOrphanPhotos(db);
    return resolveResumePhoto(db, normalizeResume(resume));
  })();
  return NextResponse.json({ resume });
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
  const db = getDatabase();
  const existing = await getResumeForUser(db, id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const remove = db.transaction(() => {
    deleteRewriteSessionsForResume(db, id);
    deleteResumeVersionsForResume(db, id);
    db.prepare(`DELETE FROM resumes WHERE id = ?`).run(id);
    pruneOrphanPhotos(db);
  });
  remove();
  return NextResponse.json({ success: true });
}
