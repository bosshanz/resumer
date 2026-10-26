import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkResumeEntries } from "../pagination";
import { themedMarkdownComponents } from "./markdown";
import type { EditableBlockKind, ResumeEditing } from "./editing";

const basePlugins = [remarkGfm, remarkResumeEntries];

type Positioned = { node?: { position?: { start: { line: number }; end: { line: number } } } };

/** 编辑模式：在原有主题组件外只追加属性，不改结构和样式 */
function editableComponents(editing: ResumeEditing, source: string): Components {
  const extra = (kind: EditableBlockKind, node: Positioned["node"]) => {
    const position = node?.position;
    if (!position) return undefined;
    return editing.blockProps(kind, source, position.start.line - 1, position.end.line - 1);
  };
  const H3 = themedMarkdownComponents.h3 as React.FC<Record<string, unknown>>;
  const P = themedMarkdownComponents.p as React.FC<Record<string, unknown>>;
  return {
    ...themedMarkdownComponents,
    li({ node, ...props }) {
      return <li {...props} {...extra("li", node)} />;
    },
    h3(props) {
      return <H3 {...props} {...extra("h3", props.node)} />;
    },
    p(props) {
      return <P {...props} {...extra("p", props.node)} />;
    },
  };
}

export function ResumeMarkdown({ children, editing }: { children: string; editing?: ResumeEditing }) {
  return (
    <ReactMarkdown
      remarkPlugins={editing ? [...basePlugins, ...editing.remarkPlugins] : basePlugins}
      components={editing ? editableComponents(editing, children) : themedMarkdownComponents}
    >
      {children}
    </ReactMarkdown>
  );
}
