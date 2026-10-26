import { extractPending } from "./doc";
import type { HumanChanges } from "./edits";
import { fieldLabel } from "./events";
import type { ActionTarget, ChatMessage, SelectionAction, TurnInput } from "./types";

const HISTORY_LIMIT = 16;
const HISTORY_CHARS = 600;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function describeHistory(history: ChatMessage[]): string {
  const recent = history.filter((message) => message.content.trim() && message.status !== "streaming").slice(-HISTORY_LIMIT);
  if (!recent.length) return "（这是第一轮对话）";
  return recent
    .map((message) => `${message.role === "user" ? "用户" : "你"}：${clip(message.content.trim(), HISTORY_CHARS)}`)
    .join("\n");
}

export function describeHumanChanges(changes: HumanChanges | null): string {
  if (!changes) return "";
  const parts: string[] = [];
  const list = (items: string[]) => items.slice(0, 12).map((line) => `  ${line}`).join("\n");
  if (changes.addedLines.length) parts.push(`用户新写或改成了这些行：\n${list(changes.addedLines)}`);
  if (changes.removedLines.length) parts.push(`用户删掉或改掉了这些行：\n${list(changes.removedLines)}`);
  if (changes.fields.length) parts.push(`用户改了这些字段：${changes.fields.map(fieldLabel).join("、")}`);
  return parts.join("\n");
}

const ACTION_TASKS: Record<SelectionAction, string> = {
  tighten:
    "把它精简：去掉空话和重复，保留动作、职责和结果，不增删任何事实。用 rewrite_bullet 改这一条，然后用一句话说明改了什么。",
  star:
    "按 STAR（情境、任务、行动、结果）重写成一句有力的要点。用户没给的情境或结果写成「待补：…」，不要编。用 rewrite_bullet 改这一条，然后问用户补哪些信息。",
  hint:
    "不要修改简历。告诉用户这条还缺什么才更有说服力（例如个人职责边界、数字结果、技术难点），用两三个具体问题问出来。",
};

function describeTarget(target: ActionTarget): string {
  const where = [target.section, target.entry].filter(Boolean).join(" › ");
  return target.bullet ? `「${where}」下的这条要点：${target.bullet}` : `「${where}」这段经历`;
}

export function describeTask(input: TurnInput): string {
  switch (input.kind) {
    case "chat":
      return `<task kind="chat">\n${input.text.trim()}\n</task>`;
    case "action":
      return `<task kind="action" action="${input.action}">\n用户选中了${describeTarget(input.target)}\n${ACTION_TASKS[input.action]}\n</task>`;
    case "import":
      return `<task kind="import">\n用户粘贴了一份旧简历的文字（可能来自 PDF，排版会乱）。把其中明确的事实整理进当前简历：基本信息、经历、要点、技能。每段经历用 add_entry，原文没有的数字和细节不要补；看不清的地方写待补。整理完用两三句话说明，并就最值得补充的一段经历提一个问题。\n<imported>\n${input.text.trim()}\n</imported>\n</task>`;
    case "review":
      return `<task kind="review">\n用户想基于现有这份简历继续完善。先通读，这一轮不要修改简历。用两三句话说说整体印象，然后挑最值得补充的一段经历，问一个具体的问题开始追问。\n</task>`;
  }
}

export function buildTurnPrompt(input: {
  content: string;
  history: ChatMessage[];
  changes: HumanChanges | null;
  task: TurnInput;
}): string {
  const pending = extractPending(input.content);
  const pendingText = pending.length
    ? pending.slice(0, 20).map((item, index) => `${index + 1}. ${item.label}（${clip(item.lineText.trim(), 80)}）`).join("\n")
    : "（没有）";
  const changes = describeHumanChanges(input.changes);
  return [
    `<resume>\n${input.content}\n</resume>`,
    changes ? `<human_edits>\n${changes}\n这些是用户的决定：不要改回、不要覆盖。\n</human_edits>` : "",
    `<pending>\n${pendingText}\n</pending>`,
    `<history>\n${describeHistory(input.history)}\n</history>`,
    describeTask(input.task),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const SCRATCH_OPENER =
  "我们从零开始写一份简历。我会像面试官一样问你几个问题，边聊边把内容写到右边。你随时可以直接在右边改，我不会覆盖你改过的地方。\n\n先说说你自己吧：你叫什么名字，想找什么方向的工作？最近一份工作（或最重要的一段项目、实习）是在哪里、做什么的？";

export function summarizeUserTurn(input: TurnInput): string {
  switch (input.kind) {
    case "chat":
      return input.text.trim();
    case "action": {
      const verb = { tighten: "精简", star: "按 STAR 重写", hint: "还缺什么" }[input.action];
      const subject = input.target.bullet || input.target.entry || input.target.section;
      return `${verb}：${clip(subject, 80)}`;
    }
    case "import":
      return `导入旧简历（${input.text.trim().length} 字）`;
    case "review":
      return "帮我完善这份简历";
  }
}
