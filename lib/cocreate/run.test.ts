import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { ensurePhotosTable } from "../photos";
import { ensureResumeVersionsTable } from "../resume-versions";
import { subscribe } from "./channel";
import { getCocreateState, revertEdit, startTurn } from "./run";
import { ensureCocreateTables } from "./store";
import type { SequencedEvent, TurnInput } from "./types";

// 用演示模型（mock）跑完整的一轮：写库、发事件、人工改动保护、撤销、出错

let db: Database.Database;
const previous = process.env.AI_PROVIDER;

beforeEach(() => {
  process.env.AI_PROVIDER = "mock";
  db = new Database(":memory:");
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY);
    INSERT INTO users VALUES ('alice');
    CREATE TABLE resumes (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
      content TEXT NOT NULL, template_id TEXT NOT NULL, theme_variables TEXT NOT NULL,
      photo TEXT, parent_id TEXT, origin_note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    INSERT INTO resumes (id, user_id, title, content, template_id, theme_variables)
    VALUES ('r1', 'alice', '简历', '---\n---\n', 'minimal', '{}');`);
  ensurePhotosTable(db);
  ensureResumeVersionsTable(db);
  ensureCocreateTables(db);
});

afterEach(() => {
  db.close();
  if (previous === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = previous;
});

async function turn(input: TurnInput): Promise<SequencedEvent[]> {
  const { runId } = startTurn(db, "alice", "r1", input);
  return new Promise((resolve) => {
    const events: SequencedEvent[] = [];
    subscribe(runId, 0, (entry) => {
      if (entry) events.push(entry);
      else resolve(events);
    });
  });
}

const content = () => (db.prepare(`SELECT content FROM resumes WHERE id = 'r1'`).get() as { content: string }).content;
const say = (text: string) => turn({ kind: "chat", text });

describe("共创一轮（演示模型）", () => {
  it("写入简历、记录编辑、事件有序，并持久化对话", async () => {
    await say("我叫林晓，想找后端开发的工作");
    await say("我2021年7月到至今在字节跳动做后端工程师");
    const events = await say("我负责重构订单服务的缓存层。另外搭建了压测平台");
    expect(events.map((e) => e.id)).toEqual(events.map((_, i) => i + 1));
    expect(events.at(-1)?.event.type).toBe("done");
    expect(events.some((e) => e.event.type === "edit")).toBe(true);
    expect(content()).toContain("### 字节跳动 | 后端工程师 | 2021.07 - 至今");
    expect(content()).toContain("「待补");

    const state = getCocreateState(db, "alice", "r1");
    expect(state.messages.filter((m) => m.role === "user")).toHaveLength(3);
    expect(state.messages.every((m) => m.status === "done")).toBe(true);
    expect(state.activeRun).toBeNull();
    expect(state.edits.length).toBeGreaterThan(0);
  });

  it("下一轮看到人工改动，不改回去；撤销 AI 编辑不影响人工内容", async () => {
    await say("我2021年7月到至今在字节跳动做后端工程师");
    await say("我负责重构订单服务的缓存层");
    const human = "- 重构订单服务的缓存层，我自己改的版本";
    const edited = content().replace(/^- .*重构订单服务的缓存层.*$/m, human);
    expect(edited).toContain(human);
    db.prepare(`UPDATE resumes SET content = ? WHERE id = 'r1'`).run(edited);

    const events = await say("另外我还接入了全链路监控告警");
    const done = events.at(-1)!.event;
    expect(done.type).toBe("done");
    expect(done.type === "done" && done.message.content).toContain("以你的版本为准");
    expect(content()).toContain(human);
    expect(content()).toContain("接入了全链路监控告警");

    const last = getCocreateState(db, "alice", "r1").edits.at(-1)!;
    const reverted = revertEdit(db, "alice", last.id);
    expect(reverted.content).not.toContain("全链路监控告警");
    expect(reverted.content).toContain(human);
    expect(() => revertEdit(db, "alice", last.id)).toThrow("已经撤销过了");
  });

  it("模型出错时整轮标记为错误，可重试", async () => {
    const events = await say("#mock-error");
    const last = events.at(-1)!.event;
    expect(last.type).toBe("error");
    const state = getCocreateState(db, "alice", "r1");
    expect(state.messages.at(-1)).toMatchObject({ role: "assistant", status: "error" });
  });

  it("别人的简历和空输入被拒绝", () => {
    expect(() => startTurn(db, "bob", "r1", { kind: "chat", text: "hi" })).toThrow("简历不存在");
    expect(() => startTurn(db, "alice", "r1", { kind: "chat", text: "  " })).toThrow("请输入内容");
  });
});
