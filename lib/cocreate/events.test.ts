import { describe, expect, it } from "vitest";
import { createEventMapper, formatSse, stepLabel } from "./events";

const delta = (text: string) => ({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: text } });

describe("SSE 事件映射", () => {
  it("文字增量原样转发；工具调用之后的新文字另起一段", () => {
    const map = createEventMapper();
    expect(map(delta("你好"))).toEqual([{ type: "text", delta: "你好" }]);
    map({ type: "tool_execution_start", toolCallId: "c1", toolName: "add_bullet", args: { section: "工作经历", entry: "字节跳动 | 后端" } });
    expect(map(delta("写好了"))).toEqual([{ type: "text", delta: "\n\n写好了" }]);
    expect(map(delta(""))).toEqual([]);
  });

  it("工具开始、结束映射为带中文标签的步骤；失败带原因", () => {
    const map = createEventMapper();
    expect(map({ type: "tool_execution_start", toolCallId: "c1", toolName: "add_bullet", args: { section: "工作经历", entry: "字节跳动 | 后端" } })).toEqual([
      { type: "step", callId: "c1", tool: "add_bullet", label: "新增要点 · 字节跳动", phase: "start" },
    ]);
    const [end] = map({
      type: "tool_execution_end",
      toolCallId: "c1",
      toolName: "add_bullet",
      isError: true,
      result: { content: [{ type: "text", text: "未写入：数字 60% 用户没有说过" }] },
    });
    expect(end).toMatchObject({ type: "step", phase: "end", ok: false, label: "新增要点 · 字节跳动", note: "未写入：数字 60% 用户没有说过" });
  });

  it("其他事件忽略", () => {
    expect(createEventMapper()({ type: "agent_start" })).toEqual([]);
  });

  it("字段步骤用中文名", () => {
    expect(stepLabel("set_profile", { field: "email" })).toBe("填写基本信息 · 邮箱");
    expect(stepLabel("read_resume", {})).toBe("读取简历");
  });

  it("formatSse 带 id，便于 Last-Event-ID 续传", () => {
    expect(formatSse({ id: 3, event: { type: "text", delta: "a\nb" } })).toBe('id: 3\ndata: {"type":"text","delta":"a\\nb"}\n\n');
  });
});
