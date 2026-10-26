import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { cocreateErrorResponse, requireUserId, unauthorized } from "@/lib/cocreate/http";
import { cancelRun } from "@/lib/cocreate/run";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { runId } = await params;
  try {
    return NextResponse.json({ cancelled: cancelRun(getDatabase(), userId, runId) });
  } catch (error) {
    return cocreateErrorResponse(error, "cancel");
  }
}
