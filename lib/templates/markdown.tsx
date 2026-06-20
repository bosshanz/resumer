import React from "react";
import type { Components } from "react-markdown";

interface HastChild {
  type: string;
  tagName?: string;
  value?: string;
}

function isWhitespaceText(c: HastChild): boolean {
  return c.type === "text" && (!c.value || c.value.trim() === "");
}

function isOnlyStrongParagraph(node: { children?: HastChild[] } | undefined): boolean {
  if (!node?.children) return false;
  const meaningful = node.children.filter((c) => !isWhitespaceText(c));
  return (
    meaningful.length === 1 &&
    meaningful[0].type === "element" &&
    meaningful[0].tagName === "strong"
  );
}

export const themedMarkdownComponents: Components = {
  p({ node, children, ...props }) {
    if (isOnlyStrongParagraph(node as { children?: HastChild[] } | undefined)) {
      return <h4 className="resume-subhead">{children}</h4>;
    }
    return <p {...props}>{children}</p>;
  },
};
