"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { extractPending } from "@/lib/cocreate/doc";
import { isResumeBlank } from "@/lib/cocreate/edits";
import type { ThemeVariables } from "@/lib/types";
import type { PageFit } from "@/lib/page-fit";
import { resolveTemplateSettings } from "@/lib/templates";
import type { ActionTarget, SelectionAction } from "@/lib/cocreate/types";
import { ChatPanel } from "./chat-panel";
import { PaperView } from "./paper-view";
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
  /** 打开「设计」面板调整主题；稿面随之实时变化 */
  onDesign: () => void;
  /** 窄屏下外部要求显示简历（例如在设计面板里点了「查看效果」） */
  showDoc?: boolean;
}

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
  onDesign,
  showDoc,
}: CocreateWorkspaceProps) {
  const [tabState, setTab] = useState<Tab>("chat");
  const tab: Tab = showDoc ? "doc" : tabState;
  const [pageFit, setPageFit] = useState<PageFit | null>(null);
  const templateName = useMemo(() => resolveTemplateSettings(templateId, themeVariables).template.name, [templateId, themeVariables]);
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
    setTab("doc");
    requestAnimationFrame(() => {
      const chip = docRef.current?.querySelector<HTMLElement>("[data-cc-pending], [data-cc-line][data-cc-pending-row]");
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
          <span className="cc-doc-hint">
            {blank ? "回答左边的问题，内容会按这套主题排在纸上" : `按「${templateName}」排版 · 点任意一条可编辑或让 AI 改写`}
          </span>
          {pageFit && (
            <span className="cc-doc-fit" data-warning={pageFit.status === "slight-overflow"} title="按当前主题字号与行高估算，与导出的 PDF 分页一致">
              {pageFit.label}
            </span>
          )}
          {pendingCount > 0 && (
            <button type="button" className="cc-pending-jump" onClick={jumpToPending}>
              {pendingCount} 处待补
            </button>
          )}
          <button type="button" className="cc-doc-design" onClick={onDesign} title="换主题、字号、颜色，稿面实时跟着变">
            调整版式
            <ChevronRight className="h-3 w-3" aria-hidden />
          </button>
        </div>
        <div ref={docRef} className="cc-doc-body">
          <PaperView
            content={content}
            onChange={onChange}
            onAction={runAction}
            busy={controller.busy}
            aiReady={!!controller.ai?.configured}
            flashLines={flashLines}
            templateId={templateId}
            themeVariables={themeVariables}
            photo={photo}
            onPageFit={setPageFit}
          />
        </div>
      </section>
    </div>
  );
}
