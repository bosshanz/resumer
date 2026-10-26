import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "../auth";
import { CocreateError } from "./run";
import { MAX_CHAT_CHARS, MAX_IMPORT_CHARS } from "./skill";
import type { TurnInput } from "./types";

export async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export function unauthorized() {
  return NextResponse.json({ error: "请先登录" }, { status: 401 });
}

export function cocreateErrorResponse(error: unknown, scope: string) {
  if (error instanceof CocreateError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error(`[cocreate:${scope}]`, error instanceof Error ? error.message : "unknown");
  return NextResponse.json({ error: "操作失败，请重试" }, { status: 500 });
}

const targetSchema = z.object({
  section: z.string().min(1).max(80),
  entry: z.string().max(200).optional(),
  bullet: z.string().max(1000).optional(),
});

export const turnSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("chat"), text: z.string().max(MAX_CHAT_CHARS) }),
  z.object({
    kind: z.literal("action"),
    action: z.enum(["tighten", "star", "hint"]),
    target: targetSchema.extend({ bullet: z.string().min(1).max(1000) }),
  }),
  z.object({ kind: z.literal("import"), text: z.string().max(MAX_IMPORT_CHARS), source: z.enum(["paste", "pdf"]).optional() }),
  z.object({ kind: z.literal("review") }),
]);

export function parseTurn(body: unknown): TurnInput | null {
  const parsed = turnSchema.safeParse(body);
  return parsed.success ? (parsed.data as TurnInput) : null;
}
