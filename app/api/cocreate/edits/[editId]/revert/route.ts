import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { cocreateErrorResponse, requireUserId, unauthorized } from "@/lib/cocreate/http";
import { revertEdit } from "@/lib/cocreate/run";
import { lastEditSeq } from "@/lib/cocreate/store";

export const runtime = "nodejs";

/** 撤销 AI 的单处修改；该处已被人工改动时返回 409，不覆盖人工内容 */
export async function POST(_request: Request, { params }: { params: Promise<{ editId: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { editId } = await params;
  const db = getDatabase();
  try {
    return NextResponse.json({ ...revertEdit(db, userId, editId), aiEditSeq: lastEditSeq(db) });
  } catch (error) {
    return cocreateErrorResponse(error, "revert-edit");
  }
}
