export const REWRITE_STATUSES = [
  "generating",
  "ready",
  "applied",
  "discarded",
  "error",
] as const;

export type RewriteStatus = (typeof REWRITE_STATUSES)[number];

export interface RewriteSession {
  id: string;
  userId: string;
  sourceResumeId: string;
  resultResumeId?: string;
  brief: string;
  draftContent: string;
  changeNotes: string[];
  pendingItems: string[];
  status: RewriteStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmittedDraft {
  content: string;
  changeNotes: string[];
  pendingItems: string[];
}

export interface RewriteAgentResult {
  draft: SubmittedDraft;
  turns: number;
}

export function isRewriteStatus(value: string): value is RewriteStatus {
  return (REWRITE_STATUSES as readonly string[]).includes(value);
}

// 会话状态流转失败的类型化哨兵。sessions 层抛出，service 层按 code 映射为 HTTP 状态；
// 不再用 error.message 字符串比对，避免重构改文案时静默失效
export type SessionTransitionCode = "GENERATING" | "NOT_FOUND" | "NOT_READY";

export class SessionTransitionError extends Error {
  code: SessionTransitionCode;

  constructor(code: SessionTransitionCode) {
    super(code);
    this.name = "SessionTransitionError";
    this.code = code;
  }
}
