import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  beginRewriteGeneration,
  createRewriteSession,
  ensureRewriteSessionsTable,
  getActiveRewriteSession,
  markStaleGeneratingSessions,
  updateRewriteSession,
} from "./sessions";

function memoryDb() {
  const db = new Database(":memory:");
  ensureRewriteSessionsTable(db);
  return db;
}

describe("rewrite sessions", () => {
  it("创建后可以按底稿取回进行中的会话", () => {
    const db = memoryDb();
    const created = createRewriteSession(db, {
      userId: "user-1",
      sourceResumeId: "resume-1",
      brief: "招聘前端",
    });

    expect(created.status).toBe("generating");
    expect(getActiveRewriteSession(db, "resume-1", "user-1")?.id).toBe(created.id);
    expect(getActiveRewriteSession(db, "resume-1", "user-2")).toBeNull();
  });

  it("另存后不再作为活动会话返回", () => {
    const db = memoryDb();
    const created = createRewriteSession(db, {
      userId: "user-1",
      sourceResumeId: "resume-1",
      brief: "招聘前端",
    });

    updateRewriteSession(db, created.id, "user-1", {
      status: "applied",
      resultResumeId: "resume-2",
      draftContent: "---\nname: 张三\n---\n",
    });

    expect(getActiveRewriteSession(db, "resume-1", "user-1")).toBeNull();
  });

  it("生成中的会话不能再开始一次", () => {
    const db = memoryDb();
    beginRewriteGeneration(db, {
      userId: "user-1",
      sourceResumeId: "resume-1",
      brief: "更偏后端",
    });
    expect(() =>
      beginRewriteGeneration(db, {
        userId: "user-1",
        sourceResumeId: "resume-1",
        brief: "再来一次",
      })
    ).toThrow("GENERATING");
  });

  it("过期的 generating 会话会被标为 error", () => {
    const db = memoryDb();
    const created = createRewriteSession(db, {
      userId: "user-1",
      sourceResumeId: "resume-1",
      brief: "招聘前端",
    });
    db.prepare(`UPDATE rewrite_sessions SET updated_at = datetime('now', '-10 minutes') WHERE id = ?`).run(
      created.id
    );

    markStaleGeneratingSessions(db, Date.now(), 120_000);
    const session = getActiveRewriteSession(db, "resume-1", "user-1");
    expect(session?.status).toBe("error");
    expect(session?.errorMessage).toMatch(/中断/);
  });
});
