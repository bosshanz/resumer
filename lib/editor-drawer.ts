export type EditorDrawer = "design" | "rewrite" | null;

export function toggleEditorDrawer(current: EditorDrawer, target: EditorDrawer): EditorDrawer {
  if (!target) return null;
  return current === target ? null : target;
}
