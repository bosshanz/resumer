import { describe, expect, it } from "vitest";
import { briefVariantLabel, groupResumesByRoot, ResumeListItem } from "./resumes";

function item(id: string, updatedAt: string, parentId?: string): ResumeListItem {
  return { id, title: id, updatedAt, parentId };
}

describe("groupResumesByRoot", () => {
  it("没有变体时按更新时间倒序平铺", () => {
    const groups = groupResumesByRoot([
      item("a", "2026-01-01 10:00:00"),
      item("b", "2026-01-02 10:00:00"),
    ]);
    expect(groups.map((g) => g.root.id)).toEqual(["b", "a"]);
    expect(groups.every((g) => g.variants.length === 0)).toBe(true);
  });

  it("变体归到母本名下，组内按更新时间倒序", () => {
    const groups = groupResumesByRoot([
      item("v2", "2026-01-03 10:00:00", "master"),
      item("master", "2026-01-01 10:00:00"),
      item("v1", "2026-01-02 10:00:00", "master"),
      item("other", "2026-01-04 10:00:00"),
    ]);
    // other 最近更新（01-04），master 组的活动是 v2（01-03），排在 other 之后
    expect(groups.map((g) => g.root.id)).toEqual(["other", "master"]);
    const master = groups.find((g) => g.root.id === "master")!;
    expect(master.variants.map((v) => v.id)).toEqual(["v2", "v1"]);
  });

  it("母本被删除后变体退化为顶层条目", () => {
    const groups = groupResumesByRoot([
      item("v1", "2026-01-02 10:00:00", "deleted-root"),
      item("v2", "2026-01-03 10:00:00", "deleted-root"),
    ]);
    // 各自成组，不挂在同一根下
    expect(groups.map((g) => g.root.id).sort()).toEqual(["v1", "v2"]);
    expect(groups.every((g) => g.variants.length === 0)).toBe(true);
  });

  it("出现链式 parent 时向上归并到最终根，不重复展示", () => {
    const groups = groupResumesByRoot([
      item("master", "2026-01-01 10:00:00"),
      item("v1", "2026-01-02 10:00:00", "master"),
      item("v2", "2026-01-03 10:00:00", "v1"),
    ]);
    expect(groups.map((g) => g.root.id)).toEqual(["master"]);
    expect(groups[0].variants.map((v) => v.id)).toEqual(["v2", "v1"]);
  });
});

describe("briefVariantLabel", () => {
  it("取第一行非空文本并去掉 Markdown 引导符", () => {
    expect(briefVariantLabel("\n\n## 高级前端工程师\n负责交易系统")).toBe("高级前端工程师");
    expect(briefVariantLabel("- 招 React 工程师")).toBe("招 React 工程师");
  });

  it("超长截断加省略号，空白返回空串", () => {
    expect(briefVariantLabel("一二三四五六七八九十一二三四五", 10)).toBe("一二三四五六七八九十…");
    expect(briefVariantLabel("   \n \n")).toBe("");
  });
});
