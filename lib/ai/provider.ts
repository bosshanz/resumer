import type { StreamFn } from "@earendil-works/pi-agent-core";
import type { Api, Model, Provider } from "@earendil-works/pi-ai";

// 服务端模型配置：只在服务端读取环境变量，Key 不进入任何响应。
// 默认 DeepSeek，旧部署只设置 DEEPSEEK_API_KEY / DEEPSEEK_MODEL 也能继续工作。

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

interface ProviderSpec {
  label: string;
  keyEnv: string[];
  defaultModel?: string;
  modelEnv?: string;
  load?: () => Promise<Provider>;
}

// 只列出经过 pi-ai 内置、协议稳定的提供方；需要别家时按同样格式加一行即可。
const PROVIDERS = {
  deepseek: {
    label: "DeepSeek",
    keyEnv: ["DEEPSEEK_API_KEY"],
    defaultModel: "deepseek-v4-flash",
    modelEnv: "DEEPSEEK_MODEL",
    load: async () => (await import("@earendil-works/pi-ai/providers/deepseek")).deepseekProvider(),
  },
  openai: {
    label: "OpenAI",
    keyEnv: ["OPENAI_API_KEY"],
    load: async () => (await import("@earendil-works/pi-ai/providers/openai")).openaiProvider(),
  },
  anthropic: {
    label: "Anthropic",
    keyEnv: ["ANTHROPIC_API_KEY"],
    load: async () => (await import("@earendil-works/pi-ai/providers/anthropic")).anthropicProvider(),
  },
  google: {
    label: "Google Gemini",
    keyEnv: ["GEMINI_API_KEY"],
    load: async () => (await import("@earendil-works/pi-ai/providers/google")).googleProvider(),
  },
  moonshotai: {
    label: "Moonshot（Kimi）",
    keyEnv: ["MOONSHOT_API_KEY"],
    load: async () => (await import("@earendil-works/pi-ai/providers/moonshotai")).moonshotaiProvider(),
  },
  "moonshotai-cn": {
    label: "Moonshot 中国站（Kimi）",
    keyEnv: ["MOONSHOT_API_KEY"],
    load: async () => (await import("@earendil-works/pi-ai/providers/moonshotai-cn")).moonshotaiCnProvider(),
  },
  zai: {
    label: "智谱 Z.ai",
    keyEnv: ["ZAI_API_KEY"],
    load: async () => (await import("@earendil-works/pi-ai/providers/zai")).zaiProvider(),
  },
  "minimax-cn": {
    label: "MiniMax 中国站",
    keyEnv: ["MINIMAX_CN_API_KEY"],
    load: async () => (await import("@earendil-works/pi-ai/providers/minimax-cn")).minimaxCnProvider(),
  },
  openrouter: {
    label: "OpenRouter",
    keyEnv: ["OPENROUTER_API_KEY"],
    load: async () => (await import("@earendil-works/pi-ai/providers/openrouter")).openrouterProvider(),
  },
  xai: {
    label: "xAI",
    keyEnv: ["XAI_API_KEY"],
    load: async () => (await import("@earendil-works/pi-ai/providers/xai")).xaiProvider(),
  },
  mistral: {
    label: "Mistral",
    keyEnv: ["MISTRAL_API_KEY"],
    load: async () => (await import("@earendil-works/pi-ai/providers/mistral")).mistralProvider(),
  },
  groq: {
    label: "Groq",
    keyEnv: ["GROQ_API_KEY"],
    load: async () => (await import("@earendil-works/pi-ai/providers/groq")).groqProvider(),
  },
  // 本地演示与测试：脚本化的假模型，不联网、不需要 Key
  mock: {
    label: "演示模型",
    keyEnv: [],
    defaultModel: "mock-interviewer",
  },
} satisfies Record<string, ProviderSpec>;

export type AiProviderId = keyof typeof PROVIDERS;

export const AI_PROVIDER_IDS = Object.keys(PROVIDERS) as AiProviderId[];

export interface AiConfig {
  provider: AiProviderId;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  label: string;
}

/** 可以返回给前端的配置摘要：不含 Key */
export interface AiConfigSummary {
  configured: boolean;
  provider: string;
  model: string;
  label: string;
  error?: string;
}

type Env = Record<string, string | undefined>;

function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value || undefined;
}

function isProviderId(value: string): value is AiProviderId {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, value);
}

export function resolveAiConfig(env: Env = process.env): AiConfig {
  const rawProvider = (read(env, "AI_PROVIDER") || "deepseek").toLowerCase();
  if (!isProviderId(rawProvider)) {
    throw new AiConfigError(
      `不支持的 AI_PROVIDER：${rawProvider}。可选：${AI_PROVIDER_IDS.join("、")}。`
    );
  }
  const spec: ProviderSpec = PROVIDERS[rawProvider];
  const modelId =
    read(env, "AI_MODEL") || (spec.modelEnv ? read(env, spec.modelEnv) : undefined) || spec.defaultModel;
  if (!modelId) {
    throw new AiConfigError(`使用 ${spec.label} 时需要设置 AI_MODEL（模型 ID）。`);
  }
  const apiKey = read(env, "AI_API_KEY") || spec.keyEnv.map((name) => read(env, name)).find(Boolean);
  if (rawProvider !== "mock" && !apiKey) {
    const names = ["AI_API_KEY", ...spec.keyEnv].join(" 或 ");
    throw new AiConfigError(`未配置 ${spec.label} 的 API Key：请在服务器设置 ${names}。`);
  }
  return {
    provider: rawProvider,
    modelId,
    apiKey,
    baseUrl: read(env, "AI_BASE_URL"),
    label: spec.label,
  };
}

export function summarizeAiConfig(env: Env = process.env): AiConfigSummary {
  try {
    const config = resolveAiConfig(env);
    return { configured: true, provider: config.provider, model: config.modelId, label: config.label };
  } catch (error) {
    const provider = (read(env, "AI_PROVIDER") || "deepseek").toLowerCase();
    return {
      configured: false,
      provider,
      model: read(env, "AI_MODEL") || "",
      label: isProviderId(provider) ? PROVIDERS[provider].label : provider,
      error: error instanceof Error ? error.message : "AI 模型配置无效。",
    };
  }
}

export interface AgentRuntime {
  model: Model<Api>;
  streamFn: StreamFn;
  getApiKey: (provider: string) => string | undefined;
}

export async function createAgentRuntime(config: AiConfig): Promise<AgentRuntime> {
  if (config.provider === "mock") {
    const { createMockRuntime } = await import("./mock");
    return createMockRuntime(config.modelId);
  }
  const spec: ProviderSpec = PROVIDERS[config.provider];
  const { createModels } = await import("@earendil-works/pi-ai");
  const models = createModels();
  const provider = await spec.load!();
  models.setProvider(provider);
  const found = models.getModel(config.provider, config.modelId);
  if (!found) {
    throw new AiConfigError(`${spec.label} 没有模型「${config.modelId}」，请检查 AI_MODEL。`);
  }
  const model = config.baseUrl ? { ...found, baseUrl: config.baseUrl } : found;
  return {
    model,
    streamFn: models.streamSimple.bind(models) as StreamFn,
    getApiKey: (provider) => (provider === config.provider ? config.apiKey : undefined),
  };
}
