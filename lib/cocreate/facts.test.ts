import { describe, expect, it } from "vitest";
import { buildFactBase, checkFacts } from "./facts";

const base = buildFactBase(["我在字节跳动做后端，2021年7月入职，把接口耗时降了 40%", "导入：美团 | 数据分析师 | 2020.03 - 2023.06"]);

describe("防编造", () => {
  it("用户说过的数字、年份可以写", () => {
    expect(checkFacts("接口耗时降低 40%", base, "bullet")).toEqual([]);
    expect(checkFacts("字节跳动 | 后端工程师 | 2021.07 - 至今", base, "heading")).toEqual([]);
    expect(checkFacts("美团 | 数据分析师 | 2020.03 - 2023.06", base, "heading")).toEqual([]);
  });

  it("编出来的数字和年份被拒绝", () => {
    expect(checkFacts("接口耗时降低 60%", base, "bullet").join()).toMatch(/60%/);
    expect(checkFacts("2019 年加入", base, "bullet").join()).toMatch(/2019/);
  });

  it("「待补」里的数字不算编造", () => {
    expect(checkFacts("QPS 提升「待补：提升到多少，如 3 倍」", base, "bullet")).toEqual([]);
  });

  it("没说过的主导性说法、公司名、联系方式被拒绝", () => {
    expect(checkFacts("主导订单系统重构", base, "bullet").join()).toMatch(/主导/);
    expect(checkFacts("阿里巴巴 | 后端 | 至今", base, "heading").join()).toMatch(/阿里巴巴/);
    expect(checkFacts("someone@example.com", base, "identity").join()).toMatch(/没有提供过/);
  });

  it("不允许 HTML 和多行", () => {
    expect(checkFacts("<b>x</b>", base, "bullet").join()).toMatch(/HTML/);
    expect(checkFacts("一行\n两行", base, "bullet").join()).toMatch(/只能写一行/);
  });
});
