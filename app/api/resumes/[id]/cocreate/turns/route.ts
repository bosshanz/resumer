import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { cocreateErrorResponse, parseTurn, requireUserId, unauthorized } from "@/lib/cocreate/http";
import { startTurn } from "@/lib/cocreate/run";

export const runtime = "nodejs";

/** 发起一轮对话：立即返回 runId，回复通过 SSE 推送，进度同时写入数据库 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const input = parseTurn(body);
  if (!input) return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  try {
    const started = startTurn(getDatabase(), userId, id, input);
    return NextResponse.json(started, { status: 202 });
  } catch (error) {
    return cocreateErrorResponse(error, "turn");
  }
}
