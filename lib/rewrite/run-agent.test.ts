import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultResumeContent } from "../types";
import { RewriteConfigError, runRewriteAgent } from "./run-agent";

// vi.mock 会被提升到文件顶部，Agent 类与脚本状态必须放在 vi.hoisted 里
type FakeAgentShape = {
  config: {
    initialState: {
      tools: {
        name: string;
        execute: (
          id: string,
          params: unknown
        ) => Promise<{ content: { type: string; text: string }[] }>;
      }[];
    };
    shouldStopAfterTurn: () => boolean;
  };
  state: { errorMessage?: string };
  promptText: string;
  releaseAbort?: () => void;
  tool: (name: string) => FakeAgentShape["config"]["initialState"]["tools"][number];
  waitForAbort: () => Promise<void>;
  runUntilStop: () => void;
};

type FakeScript = (agent: FakeAgentShape) => Promise<void> | void;

const harness = vi.hoisted(() => {
  const fakeAgents: FakeAgentShape[] = [];
  let currentScript: FakeScript | null = null;
  return {
    fakeAgents,
    setScript: (script: FakeScript | null) => {
      currentScript = script;
    },
    getScript: (): FakeScript | null => currentScript,
  };
});

vi.mock("@earendil-works/pi-agent-core", () => ({
  Agent: class {
    config: FakeAgentShape["config"];
    state = { errorMessage: undefined as string | undefined };
    promptText = "";
    releaseAbort: (() => void) | undefined;

    constructor(config: FakeAgentShape["config"]) {
      this.config = config;
      harness.fakeAgents.push(this as unknown as FakeAgentShape);
    }

    async prompt(text: string): Promise<void> {
      this.promptText = text;
      const script = harness.getScript();
      if (script) await script(this as unknown as FakeAgentShape);
    }

    abort(): void {
      this.state.errorMessage = "请求已中止";
      this.releaseAbort?.();
    }

    waitForAbort(): Promise<void> {
      return new Promise((resolve) => {
        this.releaseAbort = resolve;
      });
    }

    tool(name: string) {
      return this.config.initialState.tools.find((tool) => tool.name === name)!;
    }

    runUntilStop(): void {
      let guard = 0;
      while (!this.config.shouldStopAfterTurn()) {
        guard += 1;
        if (guard > 100) throw new Error("shouldStopAfterTurn 永不返回 true");
      }
    }
  },
}));

vi.mock("@earendil-works/pi-ai", () => ({
  Type: {
    Object: (schema: unknown) => schema,
    String: (schema: unknown) => schema,
    Array: (schema: unknown) => schema,
  },
  createModels: () => ({
    setProvider: () => {},
    getModel: () => ({}),
    streamSimple: () => {},
  }),
}));

vi.mock("@earendil-works/pi-ai/providers/deepseek", () => ({
  deepseekProvider: () => ({}),
}));

const validDraft = defaultResumeContent.replace(
  "title: 高级前端工程师",
  "title: 前端工程师（交易系统）"
);
const invalidDraft = defaultResumeContent.replace("name: 张三", "name: 李四");

async function call(input?: Partial<Parameters<typeof runRewriteAgent>[0]>) {
  return runRewriteAgent({
    sourceContent: defaultResumeContent,
    brief: "招聘前端工程师",
    ...input,
  });
}

describe("runRewriteAgent", () => {
  const originalKey = process.env.DEEPSEEK_API_KEY;
  const originalModel = process.env.DEEPSEEK_MODEL;

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.DEEPSEEK_MODEL = "test-model";
    harness.fakeAgents.length = 0;
    harness.setScript(null);
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.DEEPSEEK_MODEL;
    else process.env.DEEPSEEK_MODEL = originalModel;
  });

  it("没有 DEEPSEEK_API_KEY 时拒绝运行", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    await expect(
      runRewriteAgent({
        sourceContent: "---\nname: 张三\n---\n",
        brief: "招聘前端工程师",
      })
    ).rejects.toBeInstanceOf(RewriteConfigError);
  });

  it("读取工具后成功提交建议稿", async () => {
    harness.setScript(async (agent) => {
      const source = await agent.tool("get_source_resume").execute("c1", {});
      expect(source.content[0].text).toContain("张三");
      await agent
        .tool("submit_draft")
        .execute("c2", { content: validDraft, changeNotes: ["调整定位"], pendingItems: [] });
      agent.runUntilStop();
    });

    const result = await call();
    expect(result.draft.content).toContain("前端工程师（交易系统）");
    expect(result.draft.changeNotes).toEqual(["调整定位"]);
    expect(result.turns).toBe(1);
  });

  it("首次改写 prompt 包含 brief，followUp prompt 包含再改要求", async () => {
    await call().catch(() => {});
    expect(harness.fakeAgents[0].promptText).toContain("招聘前端工程师");

    harness.fakeAgents.length = 0;
    await call({ followUp: "把第二段改短一点" }).catch(() => {});
    expect(harness.fakeAgents[0].promptText).toContain("把第二段改短一点");
    expect(harness.fakeAgents[0].promptText).toContain("再改一版");
  });

  it("轮数耗尽且没有提交时，报错包含工具调用摘要", async () => {
    harness.setScript(async (agent) => {
      await agent.tool("get_source_resume").execute("c1", {});
      agent.runUntilStop();
    });

    await expect(call()).rejects.toThrowError(/8 轮内没有提交建议稿.*get_source_resume×1/);
  });

  it("反复提交未通过校验时，报错包含次数和最后一次校验错误", async () => {
    harness.setScript(async (agent) => {
      await agent.tool("submit_draft").execute("c1", {
        content: invalidDraft,
        changeNotes: [],
        pendingItems: [],
      });
      await agent.tool("submit_draft").execute("c2", {
        content: invalidDraft,
        changeNotes: [],
        pendingItems: [],
      });
      agent.runUntilStop();
    });

    await expect(call()).rejects.toThrowError(/2 次提交建议稿都未通过校验.*姓名/);
  });

  it("超时中止后按模型请求失败报错", async () => {
    harness.setScript((agent) => agent.waitForAbort());

    const error = await call({ timeoutMs: 20 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/模型请求失败：请求已中止/);
  });
});
