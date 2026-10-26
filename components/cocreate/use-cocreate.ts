"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ResumeEdit } from "@/lib/cocreate/edits";
import type { ChatMessage, CocreateEvent, EditRecord, TurnInput } from "@/lib/cocreate/types";

export interface AiSummary {
  configured: boolean;
  provider: string;
  model: string;
  label: string;
  error?: string;
}

export interface LiveStep {
  callId: string;
  label: string;
  phase: "start" | "end";
  ok?: boolean;
  note?: string;
}

export interface LiveRun {
  runId: string;
  messageId: string;
  text: string;
  steps: LiveStep[];
}

interface CocreateState {
  messages: ChatMessage[];
  edits: EditRecord[];
  activeRun: { id: string; assistantMessageId: string | null } | null;
  ai: AiSummary;
  lastEditSeq: number;
  content: string;
}

export interface CocreateBridge {
  /** 发起请求前把未保存的人工修改落库，确保 AI 读到的是最新稿 */
  flush: () => Promise<boolean>;
  /** AI 写入了一处修改（服务端已落库）；content 是服务端最新全文 */
  onRemoteEdit: (record: EditRecord, content: string) => void;
  /** 撤销成功：inverse 是撤销用的编辑，content 是服务端最新全文 */
  onRemoteRevert: (inverse: ResumeEdit[], content: string) => void;
  /** 首次载入时同步服务端的 AI 修改水位 */
  onSync: (lastEditSeq: number, content: string) => void;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function errorText(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === "string" && data.error ? data.error : fallback;
}

async function fetchState(resumeId: string): Promise<CocreateState> {
  const res = await fetch(`/api/resumes/${resumeId}/cocreate`, { cache: "no-store" });
  const data = (await readJson(res)) as unknown as CocreateState & { error?: string };
  if (!res.ok) throw new Error(data.error || "对话加载失败");
  return data;
}

export function useCocreate(resumeId: string, enabled: boolean, bridge: CocreateBridge) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [edits, setEdits] = useState<EditRecord[]>([]);
  const [ai, setAi] = useState<AiSummary | null>(null);
  const [live, setLive] = useState<LiveRun | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const bridgeRef = useRef(bridge);
  const resumeRef = useRef(resumeId);

  useEffect(() => {
    bridgeRef.current = bridge;
  });

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const applyState = useCallback((id: string, data: CocreateState) => {
    if (resumeRef.current !== id) return false;
    setMessages(data.messages);
    setEdits(data.edits);
    setAi(data.ai);
    setLoadError(null);
    setLoaded(true);
    bridgeRef.current.onSync(data.lastEditSeq, data.content);
    return true;
  }, []);

  const applyLoadError = useCallback((id: string, error: unknown) => {
    if (resumeRef.current === id) setLoadError(error instanceof Error ? error.message : "对话加载失败");
  }, []);

  const load = useCallback(async () => {
    const id = resumeId;
    try {
      const data = await fetchState(id);
      return applyState(id, data) ? data : null;
    } catch (error) {
      applyLoadError(id, error);
      return null;
    }
  }, [resumeId, applyState, applyLoadError]);

  const finishLive = useCallback((message: ChatMessage | null) => {
    setLive(null);
    if (message) setMessages((prev) => prev.map((item) => (item.id === message.id ? message : item)));
  }, []);

  const connect = useCallback(
    (runId: string, messageId: string) => {
      closeStream();
      setLive({ runId, messageId, text: "", steps: [] });
      const source = new EventSource(`/api/cocreate/runs/${runId}/events`);
      sourceRef.current = source;
      let finished = false;

      source.onmessage = (raw) => {
        let event: CocreateEvent;
        try {
          event = JSON.parse(raw.data) as CocreateEvent;
        } catch {
          return;
        }
        switch (event.type) {
          case "text":
            setLive((run) => (run && run.runId === runId ? { ...run, text: run.text + event.delta } : run));
            break;
          case "step":
            setLive((run) => {
              if (!run || run.runId !== runId) return run;
              const step: LiveStep = { callId: event.callId, label: event.label, phase: event.phase, ok: event.ok, note: event.note };
              const exists = run.steps.some((item) => item.callId === event.callId);
              return {
                ...run,
                steps: exists ? run.steps.map((item) => (item.callId === event.callId ? step : item)) : [...run.steps, step],
              };
            });
            break;
          case "edit":
            setEdits((prev) => (prev.some((item) => item.id === event.edit.id) ? prev : [...prev, event.edit]));
            bridgeRef.current.onRemoteEdit(event.edit, event.content);
            break;
          case "done":
            finished = true;
            finishLive(event.message);
            break;
          case "error":
            finished = true;
            finishLive(event.chat);
            if (!event.chat) setNotice(event.message);
            break;
        }
      };

      // 服务端发 end：这一轮在内存里已结束（或服务重启），以数据库为准重新载入
      source.addEventListener("end", () => {
        closeStream();
        if (!finished) {
          setLive(null);
          void load();
        }
      });

      source.onerror = () => {
        // EventSource 会带着 Last-Event-ID 自动重连；被关闭时回到数据库状态
        if (source.readyState === EventSource.CLOSED) {
          closeStream();
          if (!finished) {
            setLive(null);
            void load();
          }
        }
      };
    },
    [closeStream, finishLive, load]
  );

  useEffect(() => {
    resumeRef.current = resumeId;
    if (!enabled) return;
    let cancelled = false;
    const id = resumeId;
    fetchState(id).then(
      (data) => {
        if (cancelled || !applyState(id, data) || !data.activeRun) return;
        connect(data.activeRun.id, data.activeRun.assistantMessageId || "");
      },
      (error) => {
        if (!cancelled) applyLoadError(id, error);
      }
    );
    return () => {
      cancelled = true;
      closeStream();
      setLive(null);
    };
  }, [enabled, resumeId, applyState, applyLoadError, connect, closeStream]);

  // 切换简历：在渲染期间重置本地状态（React 推荐的“随 props 调整 state”写法）
  const [trackedId, setTrackedId] = useState(resumeId);
  if (trackedId !== resumeId) {
    setTrackedId(resumeId);
    setLoaded(false);
    setLoadError(null);
    setMessages([]);
    setEdits([]);
    setNotice(null);
  }

  const begin = useCallback(
    async (request: () => Promise<Response>) => {
      if (sending || live) return false;
      setSending(true);
      setNotice(null);
      try {
        if (!(await bridgeRef.current.flush())) {
          setNotice("简历还没保存成功，请检查网络后再发送。");
          return false;
        }
        const res = await request();
        const data = await readJson(res);
        if (!res.ok) {
          setNotice(errorText(data, "发送失败，请重试"));
          if (res.status === 409) void load();
          return false;
        }
        const userMessage = data.userMessage as ChatMessage;
        const assistantMessage = data.assistantMessage as ChatMessage;
        setMessages((prev) => [...prev.filter((item) => item.id !== userMessage.id && item.id !== assistantMessage.id), userMessage, assistantMessage]);
        connect(String(data.runId), assistantMessage.id);
        return true;
      } catch {
        setNotice("网络异常，消息没有发出，请重试。");
        return false;
      } finally {
        setSending(false);
      }
    },
    [connect, live, load, sending]
  );

  const send = useCallback(
    (input: TurnInput) =>
      begin(() =>
        fetch(`/api/resumes/${resumeId}/cocreate/turns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    [begin, resumeId]
  );

  const retry = useCallback(
    async (messageId: string) => {
      const ok = await begin(() => fetch(`/api/cocreate/messages/${messageId}/retry`, { method: "POST" }));
      if (ok) await load();
      return ok;
    },
    [begin, load]
  );

  const startScratch = useCallback(async () => {
    setNotice(null);
    const res = await fetch(`/api/resumes/${resumeId}/cocreate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "opener" }),
    });
    const data = await readJson(res);
    if (!res.ok) {
      setNotice(errorText(data, "开始失败，请重试"));
      return;
    }
    setMessages((prev) => [...prev, data.message as ChatMessage]);
  }, [resumeId]);

  const cancel = useCallback(async () => {
    if (!live) return;
    await fetch(`/api/cocreate/runs/${live.runId}/cancel`, { method: "POST" }).catch(() => undefined);
  }, [live]);

  const revert = useCallback(
    async (kind: "edit" | "message", id: string) => {
      setNotice(null);
      if (!(await bridgeRef.current.flush())) {
        setNotice("简历还没保存成功，暂时不能撤销。");
        return false;
      }
      const res = await fetch(kind === "edit" ? `/api/cocreate/edits/${id}/revert` : `/api/cocreate/messages/${id}/revert`, {
        method: "POST",
      });
      const data = await readJson(res);
      if (!res.ok) {
        setNotice(errorText(data, "撤销失败，请重试"));
        return false;
      }
      setEdits(data.edits as EditRecord[]);
      bridgeRef.current.onRemoteRevert(data.reverted as ResumeEdit[], String(data.content));
      return true;
    },
    []
  );

  const clear = useCallback(async () => {
    setNotice(null);
    const res = await fetch(`/api/resumes/${resumeId}/cocreate`, { method: "DELETE" });
    if (!res.ok) {
      setNotice(errorText(await readJson(res), "清空失败，请重试"));
      return;
    }
    await load();
  }, [load, resumeId]);

  useEffect(() => closeStream, [closeStream]);

  return {
    loaded,
    loadError,
    reload: load,
    messages,
    edits,
    ai,
    live,
    busy: sending || !!live,
    sending,
    notice,
    dismissNotice: () => setNotice(null),
    send,
    retry,
    startScratch,
    cancel,
    revert,
    clear,
  };
}

export type CocreateController = ReturnType<typeof useCocreate>;
