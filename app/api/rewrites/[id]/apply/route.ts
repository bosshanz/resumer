import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDatabase, initDb } from "@/lib/db";
import { applyRewrite, RewriteRequestError } from "@/lib/rewrite/service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

initDb();
const db = getDatabase();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const result = applyRewrite(db, { userId: session.user.id, sessionId: id });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RewriteRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[rewrites.apply]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "另存失败，请重试" }, { status: 500 });
  }
}
