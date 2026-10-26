import type { CocreateEvent, SequencedEvent } from "./types";

// 进程内的运行通道：缓存本轮全部事件，SSE 断线重连时按 Last-Event-ID 补发。
// 只是“实时层”；数据库才是事实来源，进程重启后客户端回退到重新拉取状态。

interface RunChannel {
  events: SequencedEvent[];
  listeners: Set<(entry: SequencedEvent | null) => void>;
  finished: boolean;
  abort: (() => void) | null;
}

const KEEP_FINISHED_MS = 5 * 60 * 1000;

type Registry = Map<string, RunChannel>;

function registry(): Registry {
  const scope = globalThis as typeof globalThis & { __resumerCocreateRuns?: Registry };
  if (!scope.__resumerCocreateRuns) scope.__resumerCocreateRuns = new Map();
  return scope.__resumerCocreateRuns;
}

export function openChannel(runId: string): void {
  registry().set(runId, { events: [], listeners: new Set(), finished: false, abort: null });
}

export function hasChannel(runId: string): boolean {
  return registry().has(runId);
}

export function isChannelLive(runId: string): boolean {
  const channel = registry().get(runId);
  return Boolean(channel && !channel.finished);
}

export function setAbort(runId: string, abort: () => void): void {
  const channel = registry().get(runId);
  if (channel) channel.abort = abort;
}

export function abortChannel(runId: string): boolean {
  const channel = registry().get(runId);
  if (!channel || channel.finished || !channel.abort) return false;
  channel.abort();
  return true;
}

export function publish(runId: string, event: CocreateEvent): void {
  const channel = registry().get(runId);
  if (!channel || channel.finished) return;
  const entry = { id: channel.events.length + 1, event };
  channel.events.push(entry);
  for (const listener of channel.listeners) listener(entry);
}

export function closeChannel(runId: string): void {
  const channel = registry().get(runId);
  if (!channel) return;
  channel.finished = true;
  channel.abort = null;
  for (const listener of channel.listeners) listener(null);
  channel.listeners.clear();
  const timer = setTimeout(() => registry().delete(runId), KEEP_FINISHED_MS);
  timer.unref?.();
}

/**
 * 订阅一轮运行：先补发 afterId 之后的事件，再接收新事件。
 * 回调收到 null 表示通道已结束。返回 null 表示进程内没有这轮运行（已重启或过期）。
 */
export function subscribe(
  runId: string,
  afterId: number,
  listener: (entry: SequencedEvent | null) => void
): (() => void) | null {
  const channel = registry().get(runId);
  if (!channel) return null;
  for (const entry of channel.events) {
    if (entry.id > afterId) listener(entry);
  }
  if (channel.finished) {
    listener(null);
    return () => {};
  }
  channel.listeners.add(listener);
  return () => channel.listeners.delete(listener);
}
