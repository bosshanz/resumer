import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { cocreateErrorResponse, requireUserId, unauthorized } from "@/lib/cocreate/http";
import { retryRun } from "@/lib/cocreate/run";

export const runtime = "nodejs";

/** 重试失败的一轮：用同样的输入重新发起 */
export async function POST(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { messageId } = await params;
  try {
    return NextResponse.json(retryRun(getDatabase(), userId, messageId), { status: 202 });
  } catch (error) {
    return cocreateErrorResponse(error, "retry");
  }
}
