import { getServerSession } from "next-auth/next";
import { authOptions, isGithubAuthConfigured } from "@/lib/auth";
import { getDatabase, initDb } from "@/lib/db";
import { normalizeResume } from "@/lib/resumes";
import { defaultResumeContent, Resume } from "@/lib/types";
import { Editor } from "@/components/editor";
import { Providers } from "@/components/providers";
import { LoginButton } from "@/components/login-button";
import crypto from "crypto";

export const runtime = "nodejs";

initDb();
const db = getDatabase();

async function getOrCreateResume(userId: string): Promise<Resume> {
  const existing = db
    .prepare(`SELECT * FROM resumes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`)
    .get(userId) as Record<string, unknown> | undefined;

  if (existing) {
    return normalizeResume(existing)!;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO resumes (id, user_id, title, content, template_id, theme_variables) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, "未命名简历", defaultResumeContent, "minimal", JSON.stringify({}));

  const created = db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(id) as Record<string, unknown>;
  return normalizeResume(created)!;
}

async function getResume(userId: string, resumeId?: string): Promise<Resume> {
  if (resumeId) {
    const existing = db
      .prepare(`SELECT * FROM resumes WHERE id = ? AND user_id = ?`)
      .get(resumeId, userId) as Record<string, unknown> | undefined;

    if (existing) {
      return normalizeResume(existing)!;
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
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(161,161,170,0.16),_transparent_42%)]" aria-hidden />
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-7 shadow-[0_24px_70px_-42px_rgba(24,24,27,0.45)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight">Resumer</h1>
              <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                Markdown → PDF
              </span>
            </div>
            <p className="text-lg font-medium leading-7 text-zinc-900 dark:text-zinc-100">
              写内容，设计简历，导出即用。
            </p>
            <p className="mb-5 mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              面向程序员的 Markdown 简历工作台。实时预览、多套版式与稳定 PDF 导出都在一个界面里完成。
            </p>
            <div className="mb-6 flex flex-wrap gap-2" aria-label="产品能力">
              {['实时预览', '版式与配色', 'PDF 导出'].map((feature) => (
                <span key={feature} className="rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {feature}
                </span>
              ))}
            </div>
            <LoginButton githubEnabled={isGithubAuthConfigured()} />
          </div>
          <p className="relative mt-4 text-xs text-zinc-500 dark:text-zinc-500">你的简历内容会保存在账户中。</p>
        </main>
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
