import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { applyRewrite, discardRewrite, RewriteRequestError } from "./service";
import { createRewriteSession, ensureRewriteSessionsTable, updateRewriteSession } from "./sessions";

function setup() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      template_id TEXT NOT NULL,
      theme_variables TEXT NOT NULL,
      photo TEXT,
      parent_id TEXT,
      origin_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  ensureRewriteSessionsTable(db);
  db.prepare(`INSERT INTO users (id) VALUES ('user-1')`).run();
  db.prepare(
    `INSERT INTO resumes (id, user_id, title, content, template_id, theme_variables)
     VALUES ('resume-1', 'user-1', '底稿', '---\nname: 张三\n---\n', 'minimal', '{}')`
  ).run();
  return db;
}

describe("rewrite service apply/discard", () => {
  it("另存为新简历且不覆盖底稿", () => {
    const db = setup();
    const session = createRewriteSession(db, {
      userId: "user-1",
      sourceResumeId: "resume-1",
      brief: "招聘前端工程师，要求 React 与交易系统经验。",
    });
    updateRewriteSession(db, session.id, "user-1", {
      status: "ready",
      draftContent: "---\nname: 张三\ntitle: 前端工程师\n---\n\n## 工作经历\n",
      changeNotes: ["调整了职位标题"],
    });

    const result = applyRewrite(db, { userId: "user-1", sessionId: session.id });
    const source = db.prepare(`SELECT title, content FROM resumes WHERE id = 'resume-1'`).get() as {
      title: string;
      content: string;
    };

    expect(result.resume.id).not.toBe("resume-1");
    expect(result.resume.title).toBe("底稿 · 改写 · 招聘前端工程师，要求 React…");
    expect(result.resume.content).toContain("前端工程师");
    expect(result.session.status).toBe("applied");
    expect(source.title).toBe("底稿");
    expect(source.content).toBe("---\nname: 张三\n---\n");
  });

  it("另存的变体锚定到最初的母本并记录来源摘要", () => {
    const db = setup();
    const session = createRewriteSession(db, {
      userId: "user-1",
      sourceResumeId: "resume-1",
      brief: "## 字节 · 高级前端\n负责交易中台。",
    });
    updateRewriteSession(db, session.id, "user-1", {
      status: "ready",
      draftContent: "---\nname: 张三\n---\n",
    });

    const first = applyRewrite(db, { userId: "user-1", sessionId: session.id });
    expect(first.resume.parentId).toBe("resume-1");
    expect(first.resume.originNote).toBe("字节 · 高级前端");

    // 再对变体本身做一次改写：仍应归到同一母本，而不是挂在变体下面
    const secondSession = createRewriteSession(db, {
      userId: "user-1",
      sourceResumeId: first.resume.id,
      brief: "微信 · 小程序方向",
    });
    updateRewriteSession(db, secondSession.id, "user-1", {
      status: "ready",
      draftContent: "---\nname: 张三\n---\n",
    });
    const second = applyRewrite(db, { userId: "user-1", sessionId: secondSession.id });
    expect(second.resume.parentId).toBe("resume-1");
  });

  it("拒绝把别人的会话另存下来", () => {
    const db = setup();
    const session = createRewriteSession(db, {
      userId: "user-1",
      sourceResumeId: "resume-1",
      brief: "招聘前端工程师，要求 React。",
    });

    expect(() => applyRewrite(db, { userId: "user-2", sessionId: session.id })).toThrow(
      RewriteRequestError
    );
  });

  it("放弃后不再可另存", () => {
    const db = setup();
    const session = createRewriteSession(db, {
      userId: "user-1",
      sourceResumeId: "resume-1",
      brief: "招聘前端工程师，要求 React。",
    });
    updateRewriteSession(db, session.id, "user-1", {
      status: "ready",
      draftContent: "---\nname: 张三\n---\n",
    });
    discardRewrite(db, { userId: "user-1", sessionId: session.id });
    expect(() => applyRewrite(db, { userId: "user-1", sessionId: session.id })).toThrow(/没有可另存/);
  });
});
