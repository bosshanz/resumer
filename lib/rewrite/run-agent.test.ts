import { afterEach, describe, expect, it } from "vitest";
import { RewriteConfigError, runRewriteAgent } from "./run-agent";

describe("runRewriteAgent", () => {
  const originalKey = process.env.DEEPSEEK_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
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
});
