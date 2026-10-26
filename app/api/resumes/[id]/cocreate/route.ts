import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { cocreateErrorResponse, requireUserId, unauthorized } from "@/lib/cocreate/http";
import { addScratchOpener, CocreateError, getCocreateState } from "@/lib/cocreate/run";
import { clearConversation, getActiveRun } from "@/lib/cocreate/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** 读取共创对话、AI 修改记录、进行中的回复和模型配置（不含 Key） */
export async function GET(_request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  try {
    return NextResponse.json(getCocreateState(getDatabase(), userId, id));
  } catch (error) {
    return cocreateErrorResponse(error, "state");
  }
}

/** 从零开始：插入固定开场白，不调用模型 */
export async function POST(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  let body: { kind?: string } = {};
  try {
    body = await request.json();
  } catch {
    // 空 body 视为 opener
  }
  if (body.kind && body.kind !== "opener") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const message = addScratchOpener(getDatabase(), userId, id);
    return NextResponse.json({ message });
  } catch (error) {
    return cocreateErrorResponse(error, "opener");
  }
}

/** 清空对话（不改简历正文；已写入的内容保留） */
export async function DELETE(_request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const db = getDatabase();
  try {
    getCocreateState(db, userId, id);
    if (getActiveRun(db, id)?.status === "running") throw new CocreateError("AI 还在回复，先停止再清空", 409, "busy");
    clearConversation(db, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return cocreateErrorResponse(error, "clear");
  }
}
