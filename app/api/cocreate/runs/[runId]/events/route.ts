import { getDatabase } from "@/lib/db";
import { subscribe } from "@/lib/cocreate/channel";
import { formatSse } from "@/lib/cocreate/events";
import { requireUserId, unauthorized } from "@/lib/cocreate/http";
import { getRunForUser } from "@/lib/cocreate/store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15000;

/**
 * 一轮回复的事件流。断线重连时按 Last-Event-ID 补发；
 * 进程里已没有这轮（重启或已过期）时直接发送 end，客户端回到数据库状态。
 */
export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { runId } = await params;
  const run = getRunForUser(getDatabase(), runId, userId);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const lastId = Number(request.headers.get("last-event-id") ?? url.searchParams.get("after") ?? 0) || 0;
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const end = () => {
        if (closed) return;
        send("event: end\ndata: {}\n\n");
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      send("retry: 1500\n\n");
      const unsubscribe = subscribe(runId, lastId, (entry) => {
        if (entry) send(formatSse(entry));
        else end();
      });
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe?.();
      };
      if (!unsubscribe) end();
      request.signal.addEventListener("abort", () => {
        closed = true;
        cleanup();
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
