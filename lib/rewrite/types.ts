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
