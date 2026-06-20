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
  const { frontmatter, body } = parseResumeContent(content);
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
      <Component frontmatter={frontmatter} body={body} themeVariables={mergedTheme} photo={photo} />
    </div>
  );
}
