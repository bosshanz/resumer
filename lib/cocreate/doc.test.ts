import { describe, expect, it } from "vitest";
import { commitLineEdit, extractPending, fillPending, locateLine, parseDoc, stripPending } from "./doc";

const resume = `---
name: 林晓
---

## 工作经历

### 字节跳动 | 后端工程师 | 2021.07 - 至今

- 重构订单缓存，效果「待补：量化结果」
- 搭建压测平台
`;

describe("稿面结构", () => {
  it("解析分区、经历和要点", () => {
    const model = parseDoc(resume);
    expect(model.sections.map((s) => s.title)).toEqual(["工作经历"]);
    const entry = model.sections[0].entries[0];
    expect(entry.heading).toBe("字节跳动 | 后端工程师 | 2021.07 - 至今");
    expect(entry.blocks.filter((b) => b.type === "bullet")).toHaveLength(2);
  });
});

describe("待补", () => {
  it("找出待补并给出位置", () => {
    const [item] = extractPending(resume);
    expect(item.label).toBe("量化结果");
    expect(item.lineText.slice(item.start, item.end)).toBe("「待补：量化结果」");
  });

  it("填写只替换那一处", () => {
    const [item] = extractPending(resume);
    const next = fillPending(resume, item, "命中率提升到 97%")!;
    expect(next).toContain("- 重构订单缓存，效果命中率提升到 97%");
    expect(extractPending(next)).toHaveLength(0);
  });

  it("位置失效时按占位文本找；找不到或空值时返回 null", () => {
    const [item] = extractPending(resume);
    const shifted = `\n${resume}`;
    expect(fillPending(shifted, item, "97%")).toContain("效果97%");
    expect(fillPending(resume.replace("「待补：量化结果」", "已填"), item, "97%")).toBeNull();
    expect(fillPending(resume, item, "  ")).toBeNull();
  });

  it("事实检查时忽略待补里的文字", () => {
    expect(stripPending("提升「待补：30%」")).not.toContain("30%");
  });
});

describe("稿面上的人工编辑", () => {
  const lines = ["a", "b", "x", "c", "x"];
  it("按原位置或最近的同文本行定位", () => {
    expect(locateLine(lines, 2, "x")).toBe(2);
    expect(locateLine(lines, 3, "x")).toBe(2);
    expect(locateLine(lines, 5, "x")).toBe(4);
    expect(locateLine(lines, 0, "gone")).toBe(-1);
  });

  it("AI 在上方插入行后仍改对那一行", () => {
    const model = parseDoc(resume);
    const line = model.lines.indexOf("- 搭建压测平台");
    const shifted = resume.replace("## 工作经历", "## 工作经历\n\n- 新插入");
    const next = commitLineEdit(shifted, line, "- 搭建压测平台", "- 搭建全链路压测平台")!;
    expect(next).toContain("- 搭建全链路压测平台");
    expect(next).toContain("- 新插入");
  });

  it("原文已被 AI 改掉时不覆盖，返回 null", () => {
    const changed = resume.replace("- 搭建压测平台", "- 搭建压测平台（AI 改过）");
    expect(commitLineEdit(changed, 9, "- 搭建压测平台", "- 我的版本")).toBeNull();
  });

  it("next 为 null 时删除这一行", () => {
    const line = parseDoc(resume).lines.indexOf("- 搭建压测平台");
    expect(commitLineEdit(resume, line, "- 搭建压测平台", null)).not.toContain("搭建压测平台");
  });
});
