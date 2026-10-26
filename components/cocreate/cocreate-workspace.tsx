"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Preview } from "@/components/preview";
import { extractPending } from "@/lib/cocreate/doc";
import { isResumeBlank } from "@/lib/cocreate/edits";
import type { ThemeVariables } from "@/lib/types";
import type { ActionTarget, SelectionAction } from "@/lib/cocreate/types";
import { ChatPanel } from "./chat-panel";
import { DraftView } from "./draft-view";
import type { CocreateController } from "./use-cocreate";

interface CocreateWorkspaceProps {
  controller: CocreateController;
  content: string;
  onChange: (next: string) => void;
  templateId: string;
  themeVariables: ThemeVariables;
  photo?: string;
  flashLines: Set<string>;
  onStartScratch: () => void;
  startingScratch: boolean;
}

type DocView = "draft" | "preview";
type Tab = "chat" | "doc";

export function CocreateWorkspace({
  controller,
  content,
  onChange,
  templateId,
  themeVariables,
  photo,
  flashLines,
  onStartScratch,
  startingScratch,
}: CocreateWorkspaceProps) {
  const [view, setView] = useState<DocView>("draft");
  const [tab, setTab] = useState<Tab>("chat");
  const [unseen, setUnseen] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);
  const pendingCount = useMemo(() => extractPending(content).length, [content]);
  const blank = useMemo(() => isResumeBlank(content), [content]);
  const editCount = controller.edits.length;
  const lastCount = useRef(editCount);

  // 窄屏下停留在“对话”时，AI 改了简历就在“简历”标签上提示一下
  useEffect(() => {
    if (editCount > lastCount.current && tab === "chat") setUnseen(true);
    lastCount.current = editCount;
  }, [editCount, tab]);

  const runAction = (action: SelectionAction, target: ActionTarget) => {
    setTab("chat");
    void controller.send({ kind: "action", action, target });
  };

  const jumpToPending = () => {
    setView("draft");
    setTab("doc");
    requestAnimationFrame(() => {
      const chip = docRef.current?.querySelector<HTMLElement>("[data-pending]");
      chip?.scrollIntoView({ block: "center", behavior: "smooth" });
      chip?.focus({ preventScroll: true });
    });
  };

  return (
    <div className="cc-workspace" data-tab={tab}>
      <div className="cc-tabs" role="tablist" aria-label="共创视图">
        <button type="button" role="tab" data-tab-key="chat" aria-selected={tab === "chat"} onClick={() => setTab("chat")}>
          对话
        </button>
        <button
          type="button"
          role="tab"
          data-tab-key="doc"
          aria-selected={tab === "doc"}
          onClick={() => {
            setTab("doc");
            setUnseen(false);
          }}
        >
          简历
          {unseen && <span className="cc-tab-dot" aria-label="有新改动" />}
        </button>
      </div>

      <section className="cc-chat" aria-label="对话">
        <ChatPanel controller={controller} resumeBlank={blank} onStartScratch={onStartScratch} startingScratch={startingScratch} />
      </section>

      <section className="cc-doc" aria-label="简历">
        <div className="cc-doc-head">
          <div className="studio-mode-toggle" aria-label="简历视图">
            <button type="button" aria-pressed={view === "draft"} onClick={() => setView("draft")}>
              稿面
            </button>
            <button type="button" aria-pressed={view === "preview"} onClick={() => setView("preview")}>
              成品
            </button>
          </div>
          <span className="cc-doc-hint">{view === "draft" ? "点一条要点可编辑或让 AI 改写" : "按当前模板排版"}</span>
          {pendingCount > 0 && (
            <button type="button" className="cc-pending-jump" onClick={jumpToPending}>
              {pendingCount} 处待补
            </button>
          )}
        </div>
        <div ref={docRef} className={view === "draft" ? "cc-doc-body" : "cc-doc-body is-preview"}>
          {view === "draft" ? (
            <DraftView
              content={content}
              onChange={onChange}
              onAction={runAction}
              busy={controller.busy}
              aiReady={!!controller.ai?.configured}
              flashLines={flashLines}
            />
          ) : (
            <Preview content={content} templateId={templateId} themeVariables={themeVariables} photo={photo} />
          )}
        </div>
      </section>
    </div>
  );
}
