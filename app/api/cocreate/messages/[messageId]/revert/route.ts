import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { cocreateErrorResponse, requireUserId, unauthorized } from "@/lib/cocreate/http";
import { revertMessage } from "@/lib/cocreate/run";
import { lastEditSeq } from "@/lib/cocreate/store";

export const runtime = "nodejs";

/** 撤销这一轮 AI 的全部修改（任意一处已被人工改动则整体拒绝） */
export async function POST(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { messageId } = await params;
  const db = getDatabase();
  try {
    return NextResponse.json({ ...revertMessage(db, userId, messageId), aiEditSeq: lastEditSeq(db) });
  } catch (error) {
    return cocreateErrorResponse(error, "revert-message");
  }
}
