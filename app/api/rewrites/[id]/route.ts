import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDatabase, initDb } from "@/lib/db";
import { continueRewrite, RewriteRequestError } from "@/lib/rewrite/service";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

initDb();
const db = getDatabase();

const continueSchema = z.object({
  instruction: z.string(),
});

function errorResponse(error: unknown) {
  if (error instanceof RewriteRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[rewrites]", error instanceof Error ? error.name : "unknown");
  return NextResponse.json({ error: "生成建议稿失败，请重试" }, { status: 500 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const parsed = continueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const rewrite = await continueRewrite(db, {
      userId: session.user.id,
      sessionId: id,
      instruction: parsed.data.instruction,
    });
    return NextResponse.json({ rewrite });
  } catch (error) {
    return errorResponse(error);
  }
}
