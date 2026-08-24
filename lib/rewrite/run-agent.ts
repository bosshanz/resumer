import fs from "fs";
import path from "path";
import { Agent } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import { deepseekProvider } from "@earendil-works/pi-ai/providers/deepseek";
import { AGENT_TIMEOUT_MS, MAX_AGENT_TURNS } from "./limits";
import { REWRITE_SKILL } from "./skill";
import { createRewriteTools, RewriteToolContext } from "./tools";
import { RewriteAgentResult } from "./types";

export class RewriteConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RewriteConfigError";
  }
}

export class RewriteAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RewriteAgentError";
  }
}

export function readMarkdownRules(cwd = process.cwd()): string {
  const filePath = path.join(cwd, "RESUME_MARKDOWN_RULES.md");
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "使用 YAML frontmatter + Markdown。不要改姓名、联系方式、公司、日期。不要使用 HTML。";
  }
}

export function getDeepseekApiKey(): string | undefined {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  return key || undefined;
}

function resolveModelId(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash";
}

export async function runRewriteAgent(input: {
  sourceContent: string;
  brief: string;
  currentDraft?: string;
  followUp?: string;
  markdownRules?: string;
  timeoutMs?: number;
}): Promise<RewriteAgentResult> {
  const apiKey = getDeepseekApiKey();
  if (!apiKey) {
    throw new RewriteConfigError("未配置 DEEPSEEK_API_KEY，无法生成建议稿。");
  }

  const models = createModels();
  models.setProvider(deepseekProvider());
  const model = models.getModel("deepseek", resolveModelId());
  if (!model) {
    throw new RewriteConfigError(`未知 DeepSeek 模型：${resolveModelId()}`);
  }

  const ctx: RewriteToolContext = {
    sourceContent: input.sourceContent,
    currentDraft: input.currentDraft || "",
    markdownRules: input.markdownRules || readMarkdownRules(),
    submitted: { draft: null },
  };

  let turns = 0;
  const agent = new Agent({
    initialState: {
      systemPrompt: REWRITE_SKILL,
      model,
      thinkingLevel: "off",
      tools: createRewriteTools(ctx),
    },
    streamFn: models.streamSimple.bind(models),
    getApiKey: (provider) => (provider === "deepseek" ? apiKey : undefined),
    toolExecution: "sequential",
    shouldStopAfterTurn: () => {
      turns += 1;
      return Boolean(ctx.submitted.draft) || turns >= MAX_AGENT_TURNS;
    },
  });

  const userPrompt = input.followUp
    ? `请在当前建议稿基础上按下面的要求再改一版，仍然不得编造事实，分清参与和主导，完成后调用 submit_draft。\n\n<instruction>\n${input.followUp.trim()}\n</instruction>`
    : `请根据以下改写要求，改写当前简历底稿。要求可能是一份 JD，也可能只是一句方向。先用工具读取底稿和规则，校验后再 submit_draft。\n\n<brief>\n${input.brief.trim()}\n</brief>`;

  const timeoutMs = input.timeoutMs ?? AGENT_TIMEOUT_MS;
  const timer = setTimeout(() => agent.abort(), timeoutMs);

  try {
    await agent.prompt(userPrompt);
  } finally {
    clearTimeout(timer);
  }

  if (ctx.submitted.draft) {
    return { draft: ctx.submitted.draft, turns };
  }

  const errorMessage = agent.state.errorMessage;
  throw new RewriteAgentError(errorMessage || "模型没有提交建议稿，请重试。");
}
