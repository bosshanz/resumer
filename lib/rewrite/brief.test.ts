import { describe, expect, it } from "vitest";
import { briefError } from "./brief";

describe("briefError", () => {
  it("接受短方向要求和完整 JD", () => {
    expect(briefError("更偏后端")).toBeNull();
    expect(briefError("把参与和主导写清楚")).toBeNull();
    expect(briefError("招聘前端工程师，要求 React 与交易系统经验。")).toBeNull();
  });

  it("拒绝空要求和过短要求", () => {
    expect(briefError("")).toMatch(/改写要求/);
    expect(briefError("  ")).toMatch(/改写要求/);
    expect(briefError("改")).toMatch(/改写要求/);
  });
});
