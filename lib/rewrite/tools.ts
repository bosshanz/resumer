import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { validateDraftAgainstSource } from "./validate-draft";
import { SubmittedDraft } from "./types";

export interface RewriteToolContext {
  sourceContent: string;
  currentDraft: string;
  markdownRules: string;
  submitted: { draft: SubmittedDraft | null };
}

function textResult(text: string, details: unknown, terminate = false) {
  return {
    content: [{ type: "text" as const, text }],
    details,
    terminate,
  };
}

export function createRewriteTools(ctx: RewriteToolContext): AgentTool[] {
  const getSourceResume: AgentTool = {
    name: "get_source_resume",
    label: "读取底稿",
    description: "读取只读的事实底稿 Markdown。所有经历、日期、数字只能来自这里。",
    parameters: Type.Object({}),
    execute: async () => textResult(ctx.sourceContent, { bytes: ctx.sourceContent.length }),
  };

  const getCurrentDraft: AgentTool = {
    name: "get_current_draft",
    label: "读取当前建议稿",
    description: "读取这次会话里已有的建议稿。若还没有建议稿，返回空字符串。",
    parameters: Type.Object({}),
    execute: async () => textResult(ctx.currentDraft || "", { empty: !ctx.currentDraft }),
  };

  const getMarkdownRules: AgentTool = {
    name: "get_markdown_rules",
    label: "读取 Markdown 规则",
    description: "读取 Resumer 的 Markdown 结构规则。建议稿必须遵守这些规则。",
    parameters: Type.Object({}),
    execute: async () => textResult(ctx.markdownRules, { bytes: ctx.markdownRules.length }),
  };

  const validateResume: AgentTool = {
    name: "validate_resume",
    label: "校验建议稿",
    description: "对照事实底稿校验一份完整 Markdown 建议稿，返回错误和待补项。",
    parameters: Type.Object({
      content: Type.String({ description: "完整的 YAML frontmatter + Markdown 建议稿" }),
    }),
    execute: async (_id, params) => {
      const content = String((params as { content?: unknown }).content || "");
      const result = validateDraftAgainstSource(ctx.sourceContent, content);
      return textResult(JSON.stringify(result, null, 2), result);
    },
  };

  const submitDraft: AgentTool = {
    name: "submit_draft",
    label: "提交建议稿",
    description: "提交最终建议稿。必须通过校验。请单独作为最后一次工具调用。",
    parameters: Type.Object({
      content: Type.String({ description: "完整的 YAML frontmatter + Markdown 建议稿" }),
      changeNotes: Type.Array(Type.String(), { description: "3 到 6 条变更说明" }),
      pendingItems: Type.Array(Type.String(), { description: "缺证据或底稿没有的数字，标为待补" }),
    }),
    execute: async (_id, params) => {
      const payload = params as { content?: unknown; changeNotes?: unknown; pendingItems?: unknown };
      const content = String(payload.content || "");
      const result = validateDraftAgainstSource(ctx.sourceContent, content);
      const pendingItems = uniqueStrings([
        ...asStringList(payload.pendingItems),
        ...result.pendingItems,
      ]);
      const changeNotes = uniqueStrings(asStringList(payload.changeNotes)).slice(0, 8);

      if (!result.ok) {
        return textResult(
          JSON.stringify({ ok: false, errors: result.errors, pendingItems }, null, 2),
          { ok: false, errors: result.errors, pendingItems }
        );
      }

      ctx.submitted.draft = {
        content: content.trim(),
        changeNotes,
        pendingItems,
      };
      ctx.currentDraft = content.trim();
      return textResult("建议稿已提交。", { ok: true }, true);
    },
  };

  return [getSourceResume, getCurrentDraft, getMarkdownRules, validateResume, submitDraft];
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}
