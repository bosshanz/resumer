export type EditorDrawer = "design" | "rewrite" | null;

export function toggleEditorDrawer(current: EditorDrawer, target: EditorDrawer): EditorDrawer {
  if (!target) return null;
  return current === target ? null : target;
}

export function editorDrawerClassName(open: boolean, widthClass: string): string {
  return [
    "absolute right-0 top-0 flex h-full w-full flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-200 motion-reduce:transition-none dark:border-zinc-800 dark:bg-zinc-900",
    widthClass,
    open
      ? "z-30 translate-x-0"
      : "hidden pointer-events-none",
  ].join(" ");
}
