import { describe, expect, it } from "vitest";
import { toggleEditorDrawer } from "./editor-drawer";

describe("toggleEditorDrawer", () => {
  it("打开另一个抽屉时会关掉当前抽屉", () => {
    expect(toggleEditorDrawer("rewrite", "design")).toBe("design");
    expect(toggleEditorDrawer("design", "rewrite")).toBe("rewrite");
  });

  it("再点一次当前抽屉会关闭", () => {
    expect(toggleEditorDrawer("design", "design")).toBeNull();
    expect(toggleEditorDrawer("rewrite", "rewrite")).toBeNull();
  });

  it("从全关状态打开指定抽屉", () => {
    expect(toggleEditorDrawer(null, "design")).toBe("design");
    expect(toggleEditorDrawer(null, "rewrite")).toBe("rewrite");
  });
});
