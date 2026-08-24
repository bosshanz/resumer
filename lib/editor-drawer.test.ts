import { describe, expect, it } from "vitest";
import { editorDrawerClassName, toggleEditorDrawer } from "./editor-drawer";

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

describe("editorDrawerClassName", () => {
  it("关闭时从布局中拿掉，避免和另一个抽屉并排占位", () => {
    const closed = editorDrawerClassName(false, "sm:w-[360px]");
    expect(closed).toContain("hidden");
    expect(closed).toContain("pointer-events-none");
    expect(closed).not.toContain("z-30");
  });

  it("打开时盖在预览上而不是挤占布局", () => {
    const open = editorDrawerClassName(true, "sm:w-[420px]");
    expect(open).toContain("absolute");
    expect(open).toContain("z-30");
    expect(open).toContain("translate-x-0");
    expect(open).not.toContain("invisible");
  });
});
