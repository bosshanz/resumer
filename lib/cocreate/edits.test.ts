import { describe, expect, it } from "vitest";
import {
  applyEdit,
  diffHumanChanges,
  invertEdit,
  isEditApplied,
  isResumeBlank,
  rebaseEdits,
  ResumeEdit,
} from "./edits";

const base = `---
name: 林晓
---

## 工作经历

### 字节跳动 | 后端工程师 | 2021.07 - 至今

- 重构订单缓存
`;

const append: ResumeEdit = {
  kind: "lines",
  scope: { section: "工作经历", entry: "字节跳动" },
  before: [],
  after: ["- 搭建压测平台"],
};
const rewrite: ResumeEdit = {
  kind: "lines",
  scope: { section: "工作经历", entry: "字节跳动" },
  before: ["- 重构订单缓存"],
  after: ["- 重构订单缓存，命中率提升到 97%"],
};
const title: ResumeEdit = { kind: "field", path: ["title"], before: undefined, after: "后端开发" };

function ok(content: string, edit: ResumeEdit): string {
  const result = applyEdit(content, edit);
  if (!result.ok) throw new Error(result.reason);
  return result.content;
}

describe("结构化小编辑", () => {
  it("追加到经历末尾、替换一行、设置字段", () => {
    const next = ok(ok(ok(base, append), rewrite), title);
    expect(next).toContain("- 重构订单缓存，命中率提升到 97%\n- 搭建压测平台");
    expect(next).toMatch(/title: 后端开发/);
  });

  it("原文已不在时拒绝，而不是猜", () => {
    const human = base.replace("- 重构订单缓存", "- 我手动改的");
    const result = applyEdit(human, rewrite);
    expect(result.ok).toBe(false);
    expect(applyEdit(base, { ...title, before: "别的值" }).ok).toBe(false);
  });

  it("不能删掉下面还有内容的标题", () => {
    const result = applyEdit(base, {
      kind: "lines",
      scope: { section: "工作经历" },
      before: ["### 字节跳动 | 后端工程师 | 2021.07 - 至今"],
      after: [],
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("每一条都能撤销回原样", () => {
    for (const edit of [append, rewrite, title]) {
      const next = ok(base, edit);
      expect(ok(next, invertEdit(edit))).toBe(base);
    }
  });
});

describe("保存时的重放（rebase）", () => {
  it("已体现的跳过，没体现的补上", () => {
    const withAppend = ok(base, append);
    expect(isEditApplied(withAppend, append)).toBe(true);
    expect(isEditApplied(base, append)).toBe(false);
    const { content, dropped } = rebaseEdits(withAppend, [append, rewrite]);
    expect(dropped).toBe(0);
    expect(content).toBe(ok(withAppend, rewrite));
  });

  it("和人工改动冲突的放弃，以人工为准", () => {
    const human = base.replace("- 重构订单缓存", "- 重构订单缓存（我写的）");
    const { content, dropped } = rebaseEdits(human, [rewrite]);
    expect(dropped).toBe(1);
    expect(content).toBe(human);
  });
});

describe("识别人工改动", () => {
  it("新增、删除的行和改过的字段", () => {
    const human = base
      .replace("- 重构订单缓存", "- 重构订单缓存，耗时降低一半")
      .replace("name: 林晓", "name: 林小晓");
    const changes = diffHumanChanges(base, human);
    expect(changes.addedLines).toEqual(["- 重构订单缓存，耗时降低一半"]);
    expect(changes.removedLines).toEqual(["- 重构订单缓存"]);
    expect(changes.fields).toEqual(["name"]);
  });

  it("只改空白不算改动", () => {
    const changes = diffHumanChanges(base, base.replace("- 重构订单缓存", "-   重构订单缓存  "));
    expect(changes.addedLines).toEqual([]);
    expect(changes.removedLines).toEqual([]);
  });
});

describe("空白简历", () => {
  it("没有字段也没有正文才算空白", () => {
    expect(isResumeBlank("---\n---\n")).toBe(true);
    expect(isResumeBlank("")).toBe(true);
    expect(isResumeBlank("---\nname: 林晓\n---\n")).toBe(false);
    expect(isResumeBlank("## 工作经历\n")).toBe(false);
  });
});
