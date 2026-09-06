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
  h3({ node, children, ...props }) {
    // Only split plain headings with the established pipe convention. Rich
    // Markdown (links, emphasis, code) keeps its original structure intact.
    const plain = node?.children.every((child) => child.type === "text")
      ? node.children.map((child) => child.type === "text" ? child.value : "").join("")
      : undefined;
    const parts = plain?.split(/\s*[|｜]\s*/).map((part) => part.trim());
    if (!parts || parts.length < 2 || parts.length > 3 || parts.some((part) => !part)) {
      return <h3 {...props}>{children}</h3>;
    }
    const last = parts[parts.length - 1];
    const isDate = /\b(?:19|20)\d{2}\b/.test(last) && /[-–—~至]/.test(last);
    const role = parts.length === 3 || !isDate ? parts[1] : undefined;
    if (parts.length === 3 && !isDate) return <h3 {...props}>{children}</h3>;
    return (
      <h3 {...props} className="resume-entry-heading">
        <span className="resume-entry-identity">
          <span className="resume-entry-company">{parts[0]}</span>
          {role && <span className="resume-entry-role"> · {role}</span>}
        </span>
        {isDate && <span className="resume-entry-date"> {last}</span>}
      </h3>
    );
  },
  p({ node, children, ...props }) {
    if (isOnlyStrongParagraph(node as { children?: HastChild[] } | undefined)) {
      return <h4 className="resume-subhead">{children}</h4>;
    }
    return <p {...props}>{children}</p>;
  },
};
