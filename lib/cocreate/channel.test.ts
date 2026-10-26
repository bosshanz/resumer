import { describe, expect, it } from "vitest";
import { abortChannel, closeChannel, isChannelLive, openChannel, publish, setAbort, subscribe } from "./channel";
import type { SequencedEvent } from "./types";

describe("运行通道（断线续传）", () => {
  it("重连时补发 Last-Event-ID 之后的事件，再接收新事件", () => {
    openChannel("r1");
    publish("r1", { type: "text", delta: "a" });
    publish("r1", { type: "text", delta: "b" });
    const seen: Array<SequencedEvent | null> = [];
    const off = subscribe("r1", 1, (entry) => seen.push(entry));
    publish("r1", { type: "text", delta: "c" });
    expect(seen.map((e) => e?.id)).toEqual([2, 3]);
    closeChannel("r1");
    expect(seen.at(-1)).toBeNull();
    expect(isChannelLive("r1")).toBe(false);
    off?.();
  });

  it("结束后订阅：补发全部再立即结束；结束后不再接收事件", () => {
    openChannel("r2");
    publish("r2", { type: "text", delta: "a" });
    closeChannel("r2");
    publish("r2", { type: "text", delta: "late" });
    const seen: Array<SequencedEvent | null> = [];
    subscribe("r2", 0, (entry) => seen.push(entry));
    expect(seen).toEqual([{ id: 1, event: { type: "text", delta: "a" } }, null]);
  });

  it("进程里没有这轮运行时返回 null，客户端回退到拉取状态", () => {
    expect(subscribe("missing", 0, () => {})).toBeNull();
  });

  it("停止只对运行中的通道生效", () => {
    openChannel("r3");
    let aborted = 0;
    setAbort("r3", () => (aborted += 1));
    expect(abortChannel("r3")).toBe(true);
    closeChannel("r3");
    expect(abortChannel("r3")).toBe(false);
    expect(aborted).toBe(1);
  });
});
