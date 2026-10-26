import type { ResumeEdit } from "./edits";

export type ChatRole = "user" | "assistant";
// chat：普通对话；action：选中要点后的快捷操作；import：粘贴/导入旧简历；
// review：基于现有简历开始完善；opener：从零开始时的开场白（固定文案，不调用模型）
export type ChatMessageKind = "chat" | "action" | "import" | "review" | "opener";
export type ChatStatus = "done" | "streaming" | "error" | "cancelled";
export type RunStatus = "running" | "done" | "error" | "cancelled";

export type SelectionAction = "tighten" | "star" | "hint";

export const SELECTION_ACTION_LABELS: Record<SelectionAction, string> = {
  tighten: "精简",
  star: "按 STAR 重写",
  hint: "提示该补什么",
};

export interface ActionTarget {
  section: string;
  entry?: string;
  /** 选中的要点原文；为空表示整段经历 */
  bullet?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  kind: ChatMessageKind;
  content: string;
  meta: Record<string, unknown>;
  runId: string | null;
  status: ChatStatus;
  createdAt: string;
}

export interface EditRecord {
  id: string;
  seq: number;
  runId: string | null;
  messageId: string | null;
  edit: ResumeEdit;
  label: string;
  status: "applied" | "reverted";
  createdAt: string;
}

export interface RunInfo {
  id: string;
  resumeId: string;
  status: RunStatus;
  error: string | null;
  assistantMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TurnInput =
  | { kind: "chat"; text: string }
  | { kind: "action"; action: SelectionAction; target: ActionTarget }
  | { kind: "import"; text: string; source?: "paste" | "pdf" }
  | { kind: "review" };

export type CocreateEvent =
  | { type: "status"; status: "running" }
  | { type: "text"; delta: string }
  | {
      type: "step";
      callId: string;
      tool: string;
      label: string;
      phase: "start" | "end";
      ok?: boolean;
      note?: string;
    }
  | { type: "edit"; edit: EditRecord; content: string }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; message: string; chat: ChatMessage | null };

export interface SequencedEvent {
  id: number;
  event: CocreateEvent;
}
