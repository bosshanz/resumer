import { z } from "zod";

export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
const id = z.string().min(1).max(200);
const timestamp = z.string().min(1).max(100);
const state = {
  title: z.string(),
  content: z.string(),
  template_id: z.string().min(1),
  // 保留原始 JSON 文本，避免备份过程改写旧模板的设置。
  theme_variables: z.string().refine((value) => {
    try {
      const parsed = JSON.parse(value);
      return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
    } catch { return false; }
  }),
  photo: z.string().regex(/^hash:[a-f0-9]{64}$/).nullable(),
  created_at: timestamp,
};

export const backupSchema = z.object({
  format: z.literal("resumer-backup"),
  version: z.literal(1),
  createdAt: timestamp,
  resumes: z.array(z.object({
    id, ...state, parent_id: id.nullable(), origin_note: z.string().nullable(), updated_at: timestamp,
  }).strict()),
  versions: z.array(z.object({ id, resume_id: id, ...state }).strict()),
  photos: z.array(z.object({
    ref: z.string().regex(/^hash:[a-f0-9]{64}$/),
    data: z.string().startsWith("data:image/"),
  }).strict()),
}).strict();

export type ResumeBackup = z.infer<typeof backupSchema>;

export class BackupError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "BackupError";
  }
}

export function parseBackup(value: unknown): ResumeBackup {
  const result = backupSchema.safeParse(value);
  if (!result.success) throw new BackupError("备份格式不正确或版本不受支持，请选择 Resumer 导出的 JSON 文件");
  const backup = result.data;
  function unique(values: string[]) {
    if (new Set(values).size !== values.length) throw new BackupError("备份包含重复记录，无法恢复");
  }
  unique(backup.resumes.map((r) => r.id));
  unique(backup.versions.map((v) => v.id));
  unique(backup.photos.map((p) => p.ref));
  const resumes = new Map(backup.resumes.map((r) => [r.id, r]));
  const photos = new Set(backup.photos.map((p) => p.ref));
  for (const row of [...backup.resumes, ...backup.versions]) {
    if (row.photo && !photos.has(row.photo)) throw new BackupError("备份缺少引用的照片，无法完整恢复");
  }
  for (const version of backup.versions) {
    if (!resumes.has(version.resume_id)) throw new BackupError("历史版本缺少对应简历，无法恢复");
  }
  // 已删除的母本允许缺席；环形关系则不是有效的变体结构。
  const checked = new Set<string>();
  for (const resume of backup.resumes) {
    const path = new Set<string>();
    let current: string | null = resume.id;
    while (current && resumes.has(current) && !checked.has(current)) {
      if (path.has(current)) throw new BackupError("备份中的母本关系存在循环，无法恢复");
      path.add(current);
      current = resumes.get(current)!.parent_id;
    }
    for (const visited of path) checked.add(visited);
  }
  return backup;
}
