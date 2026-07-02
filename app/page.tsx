import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDatabase, initDb } from "@/lib/db";
import { Resume, defaultResumeContent } from "@/lib/types";
import { Editor } from "@/components/editor";
import { Providers } from "@/components/providers";
import { LoginButton } from "@/components/login-button";
import crypto from "crypto";

export const runtime = "nodejs";

initDb();
const db = getDatabase();

function normalizeResume(row: Record<string, unknown>): Resume {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    content: String(row.content),
    templateId: String(row.template_id),
    themeVariables: JSON.parse(String(row.theme_variables || "{}")),
    photo: row.photo ? String(row.photo) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function getOrCreateResume(userId: string): Promise<Resume> {
  const existing = db
    .prepare(`SELECT * FROM resumes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`)
    .get(userId) as Record<string, unknown> | undefined;

  if (existing) {
    return normalizeResume(existing);
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO resumes (id, user_id, title, content, template_id, theme_variables) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, "未命名简历", defaultResumeContent, "minimal", JSON.stringify({}));

  const created = db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(id) as Record<string, unknown>;
  return normalizeResume(created);
}

async function getResume(userId: string, resumeId?: string): Promise<Resume> {
  if (resumeId) {
    const existing = db
      .prepare(`SELECT * FROM resumes WHERE id = ? AND user_id = ?`)
      .get(resumeId, userId) as Record<string, unknown> | undefined;

    if (existing) {
      return normalizeResume(existing);
    }
  }

  return getOrCreateResume(userId);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ resumeId?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <Providers>
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
            <h1 className="mb-2 text-2xl font-bold">Resumer</h1>
            <p className="mb-6 text-zinc-600 dark:text-zinc-400">
              面向程序员的 Markdown 简历生成器。登录后开始编写你的简历。
            </p>
            <LoginButton />
          </div>
        </div>
      </Providers>
    );
  }

  const { resumeId } = await searchParams;
  const resume = await getResume(session.user.id, resumeId);

  return (
    <Providers>
      <Editor initialResume={resume} />
    </Providers>
  );
}
