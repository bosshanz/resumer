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
  it("separates company, role and dates using the existing Markdown convention", () => {
    const html = renderToStaticMarkup(<ResumeMarkdown>{"### Acme | Engineer | 2021.06 - Present"}</ResumeMarkdown>);
    expect(html).toContain('class="resume-entry-company">Acme');
    expect(html).toContain('class="resume-entry-role"> · Engineer');
    expect(html).toContain('class="resume-entry-date"> 2021.06 - Present');
  });

  it("supports a date-only secondary segment without duplicating it", () => {
    const html = renderToStaticMarkup(<ResumeMarkdown>{"### 大学｜2014 - 2018"}</ResumeMarkdown>);
    expect(html).not.toContain('resume-entry-role');
    expect(html.match(/2014 - 2018/g)).toHaveLength(1);
  });

  it("preserves rich Markdown and ambiguous headings", () => {
    for (const heading of ["### [Acme](https://example.com) | Engineer", "### A | B | C", "### A |", "### A | B | C | D"]) {
      const html = renderToStaticMarkup(<ResumeMarkdown>{heading}</ResumeMarkdown>);
      expect(html).not.toContain('resume-entry-heading');
    }
    expect(renderToStaticMarkup(<ResumeMarkdown>{"### [Acme](https://example.com) | Engineer"}</ResumeMarkdown>)).toContain('href="https://example.com"');
  });

});
