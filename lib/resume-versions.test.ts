import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  createResumeVersion,
  deleteResumeVersionsForResume,
  ensureResumeVersionsTable,
  getLatestResumeVersion,
  getResumeVersion,
  KEEP_VERSIONS,
  listResumeVersions,
  shouldSnapshot,
  snapshotIfDue,
  SNAPSHOT_MIN_INTERVAL_MS,
  versionContentPreview,
} from "./resume-versions";

const state = {
  title: "底稿",
  content: "---\nname: 张三\n---\n",
  templateId: "minimal",
  themeVariables: "{}",
  photo: null as string | null,
};

function setup() {
  const db = new Database(":memory:");
  ensureResumeVersionsTable(db);
  return db;
}

describe("shouldSnapshot", () => {
  const latest = { ...state, createdAt: "2026-08-26 12:00:00", id: "v1", resumeId: "r1", userId: "u1" };
  const now = Date.parse("2026-08-26T12:04:00Z");

  it("没有历史快照时总是留档", () => {
    expect(shouldSnapshot(null, state, { manual: false })).toBe(true);
  });

  it("自动保存需要超过间隔且有变化", () => {
    expect(shouldSnapshot(latest, { ...state, content: "changed" }, { manual: false, now, minIntervalMs: SNAPSHOT_MIN_INTERVAL_MS })).toBe(false);
    const later = now + SNAPSHOT_MIN_INTERVAL_MS + 1000;
    expect(shouldSnapshot(latest, { ...state, content: "changed" }, { manual: false, now: later })).toBe(true);
  });

  it("手动保存跳过间隔但去重相同状态", () => {
    expect(shouldSnapshot(latest, { ...state, content: "changed" }, { manual: true, now })).toBe(true);
    expect(shouldSnapshot(latest, state, { manual: true, now })).toBe(false);
  });

  it("仅照片或主题变化也算变化", () => {
    expect(shouldSnapshot(latest, { ...state, themeVariables: '{"primaryColor":"#123456"}' }, { manual: true, now })).toBe(true);
    expect(shouldSnapshot(latest, { ...state, photo: "data:image/png;base64,x" }, { manual: true, now })).toBe(true);
  });
});

describe("resume versions store", () => {
  it("创建、列表倒序、读取单条", () => {
    const db = setup();
    const first = createResumeVersion(db, { resumeId: "r1", userId: "u1", ...state });
    const second = createResumeVersion(db, {
      resumeId: "r1",
      userId: "u1",
      ...state,
      content: "---\nname: 李四\n---\n",
    });

    const list = listResumeVersions(db, "r1");
    expect(list.map((v) => v.id)).toEqual([second.id, first.id]);
    expect(getResumeVersion(db, "r1", first.id)!.content).toContain("张三");
    expect(getLatestResumeVersion(db, "r1")!.id).toBe(second.id);
    expect(getResumeVersion(db, "r1", "missing")).toBeNull();
  });

  it("snapshotIfDue 遵循间隔与去重规则", () => {
    const db = setup();
    expect(snapshotIfDue(db, { resumeId: "r1", userId: "u1", manual: false, ...state })).toBe(true);

    // 相同状态：即使手动也不留档
    expect(snapshotIfDue(db, { resumeId: "r1", userId: "u1", manual: true, ...state })).toBe(false);
    // 间隔内自动保存不留档
    expect(
      snapshotIfDue(db, { resumeId: "r1", userId: "u1", manual: false, ...state, content: "v2" })
    ).toBe(false);
    // 手动保存且内容有变 → 留档
    expect(
      snapshotIfDue(db, { resumeId: "r1", userId: "u1", manual: true, ...state, content: "v2" })
    ).toBe(true);
    expect(listResumeVersions(db, "r1")).toHaveLength(2);
  });

  it("超出保留份数时清理最旧的快照", () => {
    const db = setup();
    for (let i = 0; i < KEEP_VERSIONS + 5; i += 1) {
      createResumeVersion(db, { resumeId: "r1", userId: "u1", ...state, content: `v${i}` });
    }
    const list = listResumeVersions(db, "r1");
    expect(list).toHaveLength(KEEP_VERSIONS);
    // 最新的在前，最旧的 v0 已被清理
    expect(list[0].content).toBe(`v${KEEP_VERSIONS + 4}`);
    expect(list.some((v) => v.content === "v0")).toBe(false);
  });

  it("删除简历时清理其全部快照", () => {
    const db = setup();
    createResumeVersion(db, { resumeId: "r1", userId: "u1", ...state });
    createResumeVersion(db, { resumeId: "r2", userId: "u1", ...state });
    deleteResumeVersionsForResume(db, "r1");
    expect(listResumeVersions(db, "r1")).toHaveLength(0);
    expect(listResumeVersions(db, "r2")).toHaveLength(1);
  });
});

describe("versionContentPreview", () => {
  it("压缩空白并截断", () => {
    expect(versionContentPreview("---\nname: 张三\n---\n\n## 工作经历")).toBe("--- name: 张三 --- ## 工作经历");
    expect(versionContentPreview("x".repeat(80), 60)).toBe(`${"x".repeat(60)}…`);
    expect(versionContentPreview("  \n\t ")).toBe("（空）");
  });
});
