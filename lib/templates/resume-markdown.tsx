import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkResumeEntries } from "../pagination";
import { themedMarkdownComponents } from "./markdown";

export function ResumeMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkResumeEntries]}
      components={themedMarkdownComponents}
    >
      {children}
    </ReactMarkdown>
  );
}
