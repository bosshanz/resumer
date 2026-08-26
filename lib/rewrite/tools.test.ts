import { describe, expect, it } from "vitest";
import { defaultResumeContent } from "../types";
import { createRewriteTools, createToolContext } from "./tools";

function context(source = defaultResumeContent) {
  return createToolContext({ sourceContent: source, currentDraft: "", markdownRules: "rules" });
}

describe("rewrite tools", () => {
  it("submit_draft 拒绝改姓名", async () => {
    const ctx = context();
    const submit = createRewriteTools(ctx).find((tool) => tool.name === "submit_draft")!;
    const result = await submit.execute("call-1", {
      content: defaultResumeContent.replace("name: 张三", "name: 李四"),
      changeNotes: ["改了姓名"],
      pendingItems: [],
    });

    expect(ctx.submitted.draft).toBeNull();
    expect(result.terminate).toBeFalsy();
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect(String(result.content[0].type === "text" ? result.content[0].text : "")).toMatch(/姓名/);
  });

  it("submit_draft 接受合法改写并终止循环", async () => {
    const ctx = context();
    const draft = defaultResumeContent.replace(
      "title: 高级前端工程师",
      "title: 前端工程师（交易系统）"
    );
    const submit = createRewriteTools(ctx).find((tool) => tool.name === "submit_draft")!;
    const result = await submit.execute("call-2", {
      content: draft,
      changeNotes: ["按交易岗位调整了职位标题"],
      pendingItems: [],
    });

    expect(result.terminate).toBe(true);
    expect(ctx.submitted.draft?.content).toContain("前端工程师（交易系统）");
    expect(ctx.submitted.draft?.changeNotes).toEqual(["按交易岗位调整了职位标题"]);
  });

  it("validate_resume 与 submit_draft 对同一份内容只校验一次", async () => {
    const ctx = context();
    const tools = createRewriteTools(ctx);
    const validate = tools.find((tool) => tool.name === "validate_resume")!;
    const submit = tools.find((tool) => tool.name === "submit_draft")!;

    await validate.execute("call-3", { content: validDraftContent() });
    const result = await submit.execute("call-4", {
      content: validDraftContent(),
      changeNotes: [],
      pendingItems: [],
    });

    expect(result.terminate).toBe(true);
    expect(ctx.validationCache.size).toBe(1);
    expect(ctx.submitAttempts).toBe(1);
    expect(ctx.lastSubmitErrors).toEqual([]);
  });

  it("失败的 submit_draft 记录诊断信息且不落建议稿", async () => {
    const ctx = context();
    const submit = createRewriteTools(ctx).find((tool) => tool.name === "submit_draft")!;
    await submit.execute("call-5", {
      content: defaultResumeContent.replace("name: 张三", "name: 李四"),
      changeNotes: [],
      pendingItems: [],
    });

    expect(ctx.submitted.draft).toBeNull();
    expect(ctx.submitAttempts).toBe(1);
    expect(ctx.lastSubmitErrors.join()).toContain("姓名");
    expect(ctx.trace.at(-1)).toMatchObject({ tool: "submit_draft", ok: false });
  });
});

function validDraftContent(): string {
  return defaultResumeContent.replace("title: 高级前端工程师", "title: 前端工程师（交易系统）");
}
