import { describe, expect, it } from "vitest";
import { defaultResumeContent } from "../types";
import { createRewriteTools } from "./tools";

function context(source = defaultResumeContent) {
  return {
    sourceContent: source,
    currentDraft: "",
    markdownRules: "rules",
    submitted: { draft: null as null | { content: string; changeNotes: string[]; pendingItems: string[] } },
  };
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
});
