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
    parentId: row.parent_id ? String(row.parent_id) : undefined,
    originNote: row.origin_note ? String(row.origin_note) : undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export interface ResumeListItem {
  id: string;
  title: string;
  updatedAt: string;
  parentId?: string;
  originNote?: string;
}

export interface ResumeGroup {
  root: ResumeListItem;
  variants: ResumeListItem[];
}

// 变体的 parent_id 统一指向最初的母本（见 applyRewrite / 复制接口），分组因此只有一层；
// 即便出现链式 parent 也向上解析到最终根，避免同一份简历在列表里出现两次
export function groupResumesByRoot(items: ResumeListItem[]): ResumeGroup[] {
  const byId = new Map(items.map((item) => [item.id, item]));

  function resolveRoot(start: ResumeListItem): ResumeListItem {
    let current = start;
    const seen = new Set<string>([start.id]);
    while (current.parentId && !seen.has(current.parentId)) {
      const parent = byId.get(current.parentId);
      if (!parent) break; // 母本可能已被删除：变体退化为顶层条目
      seen.add(parent.id);
      current = parent;
    }
    return current;
  }

  const groups = new Map<string, ResumeGroup>();
  for (const item of items) {
    const root = resolveRoot(item);
    let group = groups.get(root.id);
    if (!group) {
      group = { root, variants: [] };
      groups.set(root.id, group);
    }
    if (item.id !== root.id) group.variants.push(item);
  }

  // 组内按更新时间倒序；组本身按「组内最近活动」倒序，改过变体的母本会靠前
  const withRecency = Array.from(groups.values(), (group) => ({
    group,
    recency: Math.max(
      parseListTime(group.root.updatedAt),
      ...group.variants.map((variant) => parseListTime(variant.updatedAt))
    ),
  }));
  const byRecencyDesc = (a: { recency: number }, b: { recency: number }) => b.recency - a.recency;

  return withRecency
    .sort(byRecencyDesc)
    .map(({ group }) => ({
      ...group,
      variants: [...group.variants].sort(
        (a, b) => parseListTime(b.updatedAt) - parseListTime(a.updatedAt)
      ),
    }));
}

function parseListTime(value: string): number {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const timestamp = Date.parse(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

// 从改写要求（可能是整段 JD）里取第一行可读文本作为变体短标签
export function briefVariantLabel(brief: string, max = 16): string {
  for (const raw of brief.split("\n")) {
    const line = raw.replace(/^[\s#>*-]+/, "").trim();
    if (line) return line.length > max ? `${line.slice(0, max)}…` : line;
  }
  return "";
}
