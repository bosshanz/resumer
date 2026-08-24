import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResumeMarkdown } from "./resume-markdown";

describe("ResumeMarkdown", () => {
  it("wraps each job heading group in article.resume-entry", () => {
    const html = renderToStaticMarkup(
      <ResumeMarkdown>
        {`## 工作经历

### 公司 A | 工程师 | 2021 - 至今

- 事项一

### 公司 B | 顾问

- 事项二
`}
      </ResumeMarkdown>
    );

    expect(html.match(/class="resume-entry"/g)).toHaveLength(2);
    expect(html).toContain("公司 A");
    expect(html).toContain("公司 B");
  });
});
