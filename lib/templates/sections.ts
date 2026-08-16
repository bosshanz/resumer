export interface ResumeSection {
  title: string;
  body: string;
}

export function splitResumeSections(markdown: string): ResumeSection[] {
  const sections: ResumeSection[] = [];
  let title = "简历详情";
  let lines: string[] = [];

  const flush = () => {
    const body = lines.join("\n").trim();
    if (body || title !== "简历详情") {
      sections.push({ title, body });
    }
    lines = [];
  };

  for (const line of markdown.split("\n")) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      flush();
      title = match[1];
      continue;
    }
    lines.push(line);
  }

  flush();
  return sections;
}
