"use client";

import { parseResumeContent } from "@/lib/parser";
import { getTemplate } from "@/lib/templates";
import { ThemeVariables } from "@/lib/types";

interface PreviewProps {
  content: string;
  templateId: string;
  themeVariables: ThemeVariables;
  photo?: string;
  scale?: number;
}

export function Preview({ content, templateId, themeVariables, photo, scale = 1 }: PreviewProps) {
  const { frontmatter, body, frontmatterError } = parseResumeContent(content);
  const template = getTemplate(templateId) || getTemplate("minimal")!;
  const mergedTheme = { ...template.defaultTheme, ...themeVariables };

  const Component = template.component;

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "top center",
        width: "210mm",
        margin: "0 auto",
      }}
    >
      {frontmatterError && (
        <div
          role="alert"
          className="mb-3 break-words rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {frontmatterError}
        </div>
      )}
      <Component frontmatter={frontmatter} body={body} themeVariables={mergedTheme} photo={photo} />
    </div>
  );
}
