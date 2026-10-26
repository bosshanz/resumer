import type { CocreateEvent, SequencedEvent } from "./types";

// 把 pi-agent-core 的事件流映射成前端需要的少量事件：文字增量、工具步骤。
// 编辑事件由工具在写库成功后直接发出，不从这里走。

export const TOOL_LABELS: Record<string, string> = {
  read_resume: "读取简历",
  get_markdown_rules: "查看格式规范",
  set_profile: "填写基本信息",
  set_skills: "整理技能",
  add_entry: "新增经历",
  update_entry_heading: "修改经历标题",
  add_bullet: "新增要点",
  rewrite_bullet: "改写要点",
  remove_bullet: "删除要点",
};

const FIELD_LABELS: Record<string, string> = {
  name: "姓名",
  title: "求职方向",
  summary: "个人简介",
  "contact.phone": "电话",
  "contact.email": "邮箱",
  "contact.github": "GitHub",
  "contact.website": "个人网站",
  "contact.linkedin": "LinkedIn",
  "contact.location": "所在地",
};

export function fieldLabel(path: string): string {
  return FIELD_LABELS[path] || FIELD_LABELS[`contact.${path}`] || path;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function stepLabel(tool: string, args: unknown): string {
  const base = TOOL_LABELS[tool] || tool;
  const input = (args && typeof args === "object" ? args : {}) as Record<string, unknown>;
  if (tool === "set_profile" && str(input.field)) return `${base} · ${fieldLabel(str(input.field))}`;
  const where = str(input.entry).split("|")[0].trim() || str(input.heading).split("|")[0].trim() || str(input.section);
  return where ? `${base} · ${where}` : base;
}

interface AgentLikeEvent {
  type: string;
  assistantMessageEvent?: { type: string; delta?: string };
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: { content?: Array<{ type: string; text?: string }> };
  isError?: boolean;
}

function firstText(result: AgentLikeEvent["result"]): string {
  const text = result?.content?.find((part) => part.type === "text")?.text || "";
  return text.length > 120 ? `${text.slice(0, 118)}…` : text;
}

export function createEventMapper() {
  let hasText = false;
  let needsBreak = false;
  const args = new Map<string, unknown>();

  return function map(event: AgentLikeEvent): CocreateEvent[] {
    if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
      const delta = event.assistantMessageEvent.delta || "";
      if (!delta) return [];
      const prefix = needsBreak && hasText ? "\n\n" : "";
      needsBreak = false;
      hasText = true;
      return [{ type: "text", delta: prefix + delta }];
    }
    if (event.type === "tool_execution_start") {
      needsBreak = true;
      const callId = event.toolCallId || "";
      args.set(callId, event.args);
      const tool = event.toolName || "";
      return [{ type: "step", callId, tool, label: stepLabel(tool, event.args), phase: "start" }];
    }
    if (event.type === "tool_execution_end") {
      const callId = event.toolCallId || "";
      const tool = event.toolName || "";
      const ok = !event.isError;
      return [
        {
          type: "step",
          callId,
          tool,
          label: stepLabel(tool, args.get(callId)),
          phase: "end",
          ok,
          note: ok ? undefined : firstText(event.result),
        },
      ];
    }
    return [];
  };
}

export function formatSse(entry: SequencedEvent): string {
  return `id: ${entry.id}\ndata: ${JSON.stringify(entry.event)}\n\n`;
}
