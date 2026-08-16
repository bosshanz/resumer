import { Resume, ThemeVariables } from "./types";

export function parseThemeVariables(raw: unknown): ThemeVariables {
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ThemeVariables)
      : {};
  } catch {
    return {};
  }
}

export function normalizeResume(row: Record<string, unknown> | undefined): Resume | null {
  if (!row) return null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title ?? "未命名简历"),
    content: String(row.content ?? ""),
    templateId: String(row.template_id ?? "minimal"),
    themeVariables: parseThemeVariables(row.theme_variables),
    photo: row.photo ? String(row.photo) : undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
