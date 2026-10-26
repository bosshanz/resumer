import { describe, expect, it } from "vitest";
import { AiConfigError, resolveAiConfig, summarizeAiConfig } from "./provider";

describe("AI 模型配置", () => {
  it("默认 DeepSeek，兼容旧的 DEEPSEEK_API_KEY / DEEPSEEK_MODEL", () => {
    expect(resolveAiConfig({ DEEPSEEK_API_KEY: "sk-old" })).toMatchObject({
      provider: "deepseek",
      modelId: "deepseek-v4-flash",
      apiKey: "sk-old",
    });
    expect(resolveAiConfig({ DEEPSEEK_API_KEY: "sk-old", DEEPSEEK_MODEL: "deepseek-chat" }).modelId).toBe("deepseek-chat");
  });

  it("AI_MODEL 优先于各家的模型变量，AI_API_KEY 优先于各家的 Key", () => {
    const config = resolveAiConfig({
      DEEPSEEK_API_KEY: "sk-old",
      DEEPSEEK_MODEL: "deepseek-chat",
      AI_MODEL: "deepseek-reasoner",
      AI_API_KEY: "sk-generic",
    });
    expect(config.modelId).toBe("deepseek-reasoner");
    expect(config.apiKey).toBe("sk-generic");
  });

  it("按 AI_PROVIDER 查对应的 Key 变量", () => {
    expect(resolveAiConfig({ AI_PROVIDER: "OpenAI", AI_MODEL: "gpt-5-mini", OPENAI_API_KEY: "sk-openai" })).toMatchObject({
      provider: "openai",
      modelId: "gpt-5-mini",
      apiKey: "sk-openai",
    });
  });

  it("没有默认模型的提供方必须设置 AI_MODEL", () => {
    expect(() => resolveAiConfig({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" })).toThrow(/AI_MODEL/);
  });

  it("缺 Key 或提供方不支持时给出可操作的错误", () => {
    expect(() => resolveAiConfig({})).toThrow(AiConfigError);
    expect(() => resolveAiConfig({})).toThrow(/DEEPSEEK_API_KEY/);
    expect(() => resolveAiConfig({ AI_PROVIDER: "nope" })).toThrow(/不支持的 AI_PROVIDER/);
  });

  it("mock 不需要 Key", () => {
    expect(resolveAiConfig({ AI_PROVIDER: "mock" })).toMatchObject({ provider: "mock", modelId: "mock-interviewer" });
  });

  it("给前端的摘要里没有 Key", () => {
    const summary = summarizeAiConfig({ DEEPSEEK_API_KEY: "sk-secret-value" });
    expect(summary).toEqual({ configured: true, provider: "deepseek", model: "deepseek-v4-flash", label: "DeepSeek" });
    expect(JSON.stringify(summary)).not.toContain("sk-secret");
    const missing = summarizeAiConfig({ AI_PROVIDER: "openai", AI_MODEL: "gpt-5-mini" });
    expect(missing.configured).toBe(false);
    expect(missing.error).toMatch(/OPENAI_API_KEY/);
  });
});
