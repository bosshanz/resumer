import { describe, expect, it } from "vitest";
import { defaultResumeContent } from "../types";
import { validateDraftAgainstSource } from "./validate-draft";

const source = defaultResumeContent;

describe("validateDraftAgainstSource", () => {
  it("接受只改 summary、title、skills 顺序和 bullet 的稿件", () => {
    const draft = source
      .replace("title: 高级前端工程师", "title: 前端架构师")
      .replace(
        "summary: 8 年 Web 开发经验，专注于 React 生态与工程化，热爱开源与技术分享。",
        "summary: 面向交易系统的前端工程师，8 年 React 与工程化经验。"
      )
      .replace(
        "- 负责核心交易链路前端架构，支撑日均千万级 UV。",
        "- 负责核心交易链路前端架构，支撑日均千万级 UV，匹配高并发交易场景。"
      );

    const result = validateDraftAgainstSource(source, draft);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("拒绝改姓名或联系方式", () => {
    const draft = source.replace("name: 张三", "name: 李四");
    const result = validateDraftAgainstSource(source, draft);

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("姓名"))).toBe(true);
  });

  it("拒绝增删 ### 条目或改日期公司", () => {
    const draft = source.replace(
      "### 某某科技 | 高级前端工程师 | 2021.06 - 至今",
      "### 某某科技 | 技术总监 | 2020.01 - 至今"
    );
    const result = validateDraftAgainstSource(source, draft);

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("条目"))).toBe(true);
  });

  it("把底稿没有的数字标成待补，而不是直接失败", () => {
    const draft = source.replace(
      "- 负责企业级 SaaS 平台前端开发。",
      "- 负责企业级 SaaS 平台前端开发，把发布频率提升 300%。"
    );
    const result = validateDraftAgainstSource(source, draft);

    expect(result.ok).toBe(true);
    expect(result.pendingItems.some((item) => item.includes("300%"))).toBe(true);
  });

  it("拒绝在某条经历里增加主导或负责人", () => {
    const draft = source.replace(
      "- 设计并实现低代码表单引擎，支持复杂业务规则配置。",
      "- 作为项目负责人从零到一设计并实现低代码表单引擎，支持复杂业务规则配置。"
    );
    const result = validateDraftAgainstSource(source, draft);

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("负责人") || error.includes("从零到一"))).toBe(true);
  });

  it("拒绝在已有主导的条目里再增加主导次数", () => {
    const draft = source.replace(
      "- 负责核心交易链路前端架构，支撑日均千万级 UV。",
      "- 主导核心交易链路前端架构，支撑日均千万级 UV。"
    );
    const result = validateDraftAgainstSource(source, draft);

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("主导") && error.includes("增加到"))).toBe(true);
  });

  it("解析失败时返回错误", () => {
    const result = validateDraftAgainstSource(source, "## 只有正文");

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
