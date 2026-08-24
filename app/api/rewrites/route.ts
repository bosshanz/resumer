import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDatabase, initDb } from "@/lib/db";
import { loadActiveRewrite, RewriteRequestError, startRewrite } from "@/lib/rewrite/service";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

initDb();
const db = getDatabase();

const createSchema = z.object({
  resumeId: z.string().min(1),
  brief: z.string(),
});

function errorResponse(error: unknown) {
  if (error instanceof RewriteRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[rewrites]", error instanceof Error ? error.name : "unknown");
  return NextResponse.json({ error: "生成建议稿失败，请重试" }, { status: 500 });
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resumeId = new URL(request.url).searchParams.get("resumeId") || "";
  if (!resumeId) {
    return NextResponse.json({ error: "Missing resumeId" }, { status: 400 });
  }

  try {
    const rewrite = loadActiveRewrite(db, resumeId, session.user.id);
    return NextResponse.json({ rewrite });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const rewrite = await startRewrite(db, {
      userId: session.user.id,
      resumeId: parsed.data.resumeId,
      brief: parsed.data.brief,
    });
    return NextResponse.json({ rewrite });
  } catch (error) {
    return errorResponse(error);
  }
}
