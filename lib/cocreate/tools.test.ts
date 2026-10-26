import { describe, expect, it } from "vitest";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { applyEdit, ResumeEdit } from "./edits";
import { CocreateToolContext, createCocreateTools, ToolRefusal } from "./tools";

const base = `---
name: 林晓
---

## 工作经历

### 字节跳动 | 后端工程师 | 2021.07 - 至今

- 重构订单服务的缓存层
`;

function setup(facts: string[], options: Partial<CocreateToolContext> = {}) {
  let content = base;
  const commits: Array<{ edit: ResumeEdit; label: string }> = [];
  const ctx: CocreateToolContext = {
    readContent: () => content,
    commit: (edit, label) => {
      const result = applyEdit(content, edit);
      if (!result.ok) throw new Error(result.reason);
      content = result.content;
      commits.push({ edit, label });
      return content;
    },
    view: base,
    facts,
    protectedLines: new Set(),
    removedLines: new Set(),
    protectedFields: new Set(),
    action: null,
    markdownRules: "规范",
    editCount: 0,
    ...options,
  };
  const tools = createCocreateTools(ctx);
  const call = (name: string, params: Record<string, unknown>) => {
    const tool = tools.find((item) => item.name === name) as AgentTool;
    if (!tool) throw new Error(`no tool ${name}`);
    return tool.execute("call", params as never);
  };
  return {
    ctx,
    commits,
    call,
    get content() {
      return content;
    },
    setContent(next: string) {
      content = next;
    },
  };
}

const facts = ["2021年7月在字节跳动做后端工程师，负责重构订单服务的缓存层，还搭建了压测平台"];

describe("防编造", () => {
  it("用户说过的内容可以写入", async () => {
    const t = setup(facts);
    await t.call("add_bullet", { section: "工作经历", entry: "字节跳动", text: "搭建压测平台" });
    expect(t.content).toContain("- 重构订单服务的缓存层\n- 搭建压测平台");
    expect(t.commits[0].label).toBe("新增要点 · 字节跳动");
  });

  it("编出来的数字被拒绝，什么也不写", async () => {
    const t = setup(facts);
    await expect(t.call("add_bullet", { section: "工作经历", entry: "字节跳动", text: "缓存命中率提升 30%" })).rejects.toThrow(
      /30%.*用户没有说过/
    );
    expect(t.commits).toHaveLength(0);
  });

  it("没提过的公司被拒绝", async () => {
    const t = setup(facts);
    await expect(t.call("add_entry", { section: "工作经历", heading: "阿里巴巴 | 后端 | 至今" })).rejects.toBeInstanceOf(ToolRefusal);
  });

  it("缺的数字写成「待补」可以写入，并提醒模型去问", async () => {
    const t = setup(facts);
    const result = await t.call("rewrite_bullet", {
      section: "工作经历",
      old_text: "重构订单服务的缓存层",
      new_text: "重构订单服务的缓存层，命中率提升到「待补：提升到多少，如 95%」",
    });
    expect(t.content).toContain("「待补：提升到多少，如 95%」");
    expect(result.content[0]).toMatchObject({ text: expect.stringContaining("待补") });
  });
});

describe("尊重人工改动", () => {
  it("用户手动改过的行受保护，AI 不能改写或删除", async () => {
    const human = "- 重构订单服务的缓存层，耗时降低一半";
    const t = setup(facts, { protectedLines: new Set([human]) });
    t.setContent(base.replace("- 重构订单服务的缓存层", human));
    t.ctx.view = t.ctx.readContent();
    await expect(
      t.call("rewrite_bullet", { section: "工作经历", old_text: "重构订单服务的缓存层，耗时降低一半", new_text: "重构订单服务的缓存层" })
    ).rejects.toThrow(/受保护/);
    await expect(t.call("remove_bullet", { section: "工作经历", text: "重构订单服务的缓存层，耗时降低一半" })).rejects.toThrow(/受保护/);
    expect(t.commits).toHaveLength(0);
  });

  it("运行中途用户改了简历：下一次工具调用会发现、纳入保护并告诉模型", async () => {
    const t = setup(facts);
    const human = "- 重构订单服务的缓存层（我自己改的）";
    t.setContent(base.replace("- 重构订单服务的缓存层", human));
    const result = await t.call("read_resume", {});
    expect(result.content[0]).toMatchObject({ text: expect.stringContaining("用户刚刚手动修改了简历") });
    expect(t.ctx.protectedLines.has(human)).toBe(true);
    expect(t.ctx.removedLines.has("- 重构订单服务的缓存层")).toBe(true);
    // 用户删掉的旧句子，AI 不能再加回去
    await expect(t.call("add_bullet", { section: "工作经历", entry: "字节跳动", text: "重构订单服务的缓存层" })).rejects.toThrow(/删掉/);
  });

  it("用户手动改过的字段受保护", async () => {
    const t = setup(["我叫林晓晓"], { protectedFields: new Set(["name"]) });
    await expect(t.call("set_profile", { field: "name", value: "林晓晓" })).rejects.toThrow(/姓名.*受保护/);
  });

  it("编辑基于过期内容时写入失败，不覆盖人工内容", async () => {
    const t = setup(facts);
    // 模型看到的还是旧版本，但用户已经删掉了这一条
    t.setContent(base.replace("- 重构订单服务的缓存层\n", ""));
    await expect(
      t.call("rewrite_bullet", { section: "工作经历", old_text: "重构订单服务的缓存层", new_text: "重构订单服务的缓存层，搭建压测平台" })
    ).rejects.toThrow(/没有找到这条要点/);
  });
});

describe("选中要点的快捷操作", () => {
  const target = { section: "工作经历", entry: "字节跳动 | 后端工程师 | 2021.07 - 至今", bullet: "重构订单服务的缓存层" };

  it("只开放改写选中那一条", async () => {
    const t = setup(facts, { action: { action: "star", target } });
    expect(() => t.call("add_bullet", { section: "工作经历", text: "搭建压测平台" })).toThrow(/no tool/);
    await t.call("rewrite_bullet", {
      section: "工作经历",
      old_text: "重构订单服务的缓存层",
      new_text: "在「待补：业务背景」下，重构订单服务的缓存层，最终「待补：结果与数字」",
    });
    expect(t.content).toContain("在「待补：业务背景」下");
    await expect(
      t.call("rewrite_bullet", { section: "工作经历", old_text: "在「待补：业务背景」下，重构订单服务的缓存层，最终「待补：结果与数字」", new_text: "x" })
    ).rejects.toThrow(/只能改用户选中的那一条/);
  });

  it("「提示该补什么」不能改简历", () => {
    const t = setup(facts, { action: { action: "hint", target } });
    expect(() => t.call("rewrite_bullet", {})).toThrow(/no tool/);
  });
});
