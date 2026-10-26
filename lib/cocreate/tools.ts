import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { readBuilder } from "../resume-builder";
import {
  DocBlock,
  DocEntry,
  DocModel,
  DocSection,
  entryOrganization,
  extractPending,
  findEntry,
  findSection,
  parseDoc,
} from "./doc";
import {
  diffHumanChanges,
  EditScope,
  getField,
  hasHumanChanges,
  normalizeLine,
  ResumeEdit,
} from "./edits";
import { fieldLabel } from "./events";
import { buildFactBase, checkFacts, factError, FactKind } from "./facts";
import { describeHumanChanges } from "./prompt";
import type { ActionTarget, SelectionAction } from "./types";

export interface CocreateToolContext {
  /** 读数据库里此刻的简历内容 */
  readContent: () => string;
  /** 在事务里应用编辑、写库并记录；冲突时抛错。返回写入后的内容 */
  commit: (edit: ResumeEdit, label: string) => string;
  /** AI 最近一次看到的内容（每次写入后同步） */
  view: string;
  /** 用户亲口给出的事实：对话、导入文本 */
  facts: string[];
  protectedLines: Set<string>;
  removedLines: Set<string>;
  protectedFields: Set<string>;
  action: { action: SelectionAction; target: ActionTarget } | null;
  markdownRules: string;
  editCount: number;
}

export class ToolRefusal extends Error {}

function ok(text: string, details: unknown = {}) {
  return { content: [{ type: "text" as const, text }], details };
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanBullet(value: unknown): string {
  return str(value).replace(/^[-*+]\s+/, "").trim();
}

/** 发现用户在本轮运行期间又动了简历：纳入保护，并告诉模型 */
export function syncView(ctx: CocreateToolContext): string {
  const current = ctx.readContent();
  if (current === ctx.view) return "";
  const changes = diffHumanChanges(ctx.view, current);
  ctx.view = current;
  if (!hasHumanChanges(changes)) return "";
  for (const line of changes.addedLines) ctx.protectedLines.add(line);
  for (const line of changes.removedLines) ctx.removedLines.add(line);
  for (const field of changes.fields) ctx.protectedFields.add(field);
  return `\n注意：用户刚刚手动修改了简历。\n${describeHumanChanges(changes)}\n这些内容受保护，不要覆盖。`;
}

function requireFacts(ctx: CocreateToolContext, text: string, kind: FactKind): void {
  const problems = checkFacts(text, buildFactBase([...ctx.facts, ctx.view]), kind);
  if (problems.length) throw new ToolRefusal(factError(problems));
}

function requireNotRemoved(ctx: CocreateToolContext, line: string): void {
  if (ctx.removedLines.has(normalizeLine(line))) {
    throw new ToolRefusal("用户刚手动删掉了这一条，不要再加回去。确实需要的话先在回复里问用户。");
  }
}

function isActionTarget(ctx: CocreateToolContext, text: string): boolean {
  const bullet = ctx.action?.target.bullet;
  return Boolean(bullet && normalizeLine(cleanBullet(bullet)) === normalizeLine(cleanBullet(text)));
}

function requireUnprotected(ctx: CocreateToolContext, line: string): void {
  if (ctx.protectedLines.has(normalizeLine(line))) {
    throw new ToolRefusal("这一行是用户刚手动写或改的，受保护，不能修改。如有建议，请在回复里告诉用户，由用户决定。");
  }
}

function forbidDuringAction(ctx: CocreateToolContext, tool: string): void {
  if (ctx.action) {
    throw new ToolRefusal(`这一轮只处理用户选中的内容，不能调用 ${tool}。`);
  }
}

function listBullets(blocks: DocBlock[]): string {
  const bullets = blocks.filter((block) => block.type === "bullet");
  if (!bullets.length) return "（这里还没有要点）";
  return bullets.map((block, index) => `${index + 1}. ${block.type === "bullet" ? block.text : ""}`).join("\n");
}

function sectionOrThrow(model: DocModel, title: string): DocSection {
  const section = findSection(model, title);
  if (!section) {
    const titles = model.sections.map((item) => item.title).join("、") || "（还没有分区）";
    throw new ToolRefusal(`找不到分区「${title}」。现有分区：${titles}`);
  }
  return section;
}

function entryOrThrow(section: DocSection, query: string): DocEntry {
  const entry = findEntry(section, query);
  if (!entry) {
    const headings = section.entries.map((item) => item.heading).join("；") || "（还没有经历）";
    throw new ToolRefusal(`分区「${section.title}」里找不到唯一的经历「${query}」。现有经历：${headings}`);
  }
  return entry;
}

interface BulletHit {
  scope: EditScope;
  blocks: DocBlock[];
  block: Extract<DocBlock, { type: "bullet" }>;
}

function findBullet(model: DocModel, sectionTitle: string, entryQuery: string, text: string): BulletHit {
  const section = sectionOrThrow(model, sectionTitle);
  const key = normalizeLine(cleanBullet(text));
  const picked = entryQuery ? entryOrThrow(section, entryQuery) : null;
  const candidates: Array<{ scope: EditScope; blocks: DocBlock[] }> = picked
    ? [{ scope: { section: section.title, entry: picked.heading }, blocks: picked.blocks }]
    : [
        { scope: { section: section.title }, blocks: section.blocks },
        ...section.entries.map((entry) => ({ scope: { section: section.title, entry: entry.heading }, blocks: entry.blocks })),
      ];
  const hits: BulletHit[] = [];
  for (const candidate of candidates) {
    for (const block of candidate.blocks) {
      if (block.type === "bullet" && normalizeLine(block.text) === key) hits.push({ ...candidate, block });
    }
  }
  if (hits.length === 1) return hits[0];
  const where = candidates.length === 1 ? listBullets(candidates[0].blocks) : candidates.map((c) => listBullets(c.blocks)).join("\n");
  if (hits.length > 1) throw new ToolRefusal("这条要点出现了多次，请同时给出 entry 来定位。");
  throw new ToolRefusal(`没有找到这条要点（用户可能刚改过）。当前要点：\n${where}`);
}

const PROFILE_FIELDS = ["name", "title", "summary", "phone", "email", "github", "website", "linkedin", "location"] as const;
type ProfileField = (typeof PROFILE_FIELDS)[number];

function profilePath(field: ProfileField): string[] {
  return ["name", "title", "summary"].includes(field) ? [field] : ["contact", field];
}

function done(ctx: CocreateToolContext, message: string, note: string, text = "") {
  ctx.editCount += 1;
  const pending = text.includes("「待补") ? " 里面有待补，记得在回复里问用户。" : "";
  return ok(`${message}${pending}${note}`);
}

export function createCocreateTools(ctx: CocreateToolContext): AgentTool[] {
  const readResume: AgentTool = {
    name: "read_resume",
    label: "读取简历",
    description: "读取简历此刻的最新全文（用户可能刚改过）、待补清单和受保护的内容。",
    parameters: Type.Object({}),
    execute: async () => {
      const note = syncView(ctx);
      const pending = extractPending(ctx.view);
      const protectedText = [...ctx.protectedLines].slice(0, 20).join("\n");
      return ok(
        [
          `<resume>\n${ctx.view}\n</resume>`,
          pending.length ? `待补：${pending.map((item) => item.label).join("、")}` : "没有待补。",
          protectedText ? `受保护（用户手动写的）：\n${protectedText}` : "",
          note,
        ]
          .filter(Boolean)
          .join("\n\n")
      );
    },
  };

  const getRules: AgentTool = {
    name: "get_markdown_rules",
    label: "查看格式规范",
    description: "读取简历 Markdown 结构规范。",
    parameters: Type.Object({}),
    execute: async () => ok(ctx.markdownRules),
  };

  const setProfile: AgentTool = {
    name: "set_profile",
    label: "填写基本信息",
    description:
      "设置简历头部的一个字段：name 姓名、title 求职方向、summary 个人简介，或联系方式 phone / email / github / website / linkedin / location。值必须来自用户。",
    parameters: Type.Object({
      field: Type.String({ description: PROFILE_FIELDS.join(" | ") }),
      value: Type.String(),
    }),
    execute: async (_id, params) => {
      forbidDuringAction(ctx, "set_profile");
      const note = syncView(ctx);
      const field = str((params as { field?: unknown }).field) as ProfileField;
      const value = str((params as { value?: unknown }).value);
      if (!PROFILE_FIELDS.includes(field)) throw new ToolRefusal(`field 只能是：${PROFILE_FIELDS.join("、")}`);
      if (!value) throw new ToolRefusal("值不能为空；需要清空请让用户自己在简历里删。");
      const path = profilePath(field);
      const key = path.join(".");
      if (ctx.protectedFields.has(key)) {
        throw new ToolRefusal(`「${fieldLabel(key)}」是用户刚手动改的，受保护，不能修改。`);
      }
      const kind: FactKind = field === "title" || field === "summary" ? "free" : "identity";
      requireFacts(ctx, value, kind);
      const model = readBuilder(ctx.view);
      if (model.error) throw new ToolRefusal(`简历头部 YAML 有误，先请用户修复：${model.error}`);
      const before = getField(model.fields as Record<string, unknown>, path);
      if (before === value) return ok("内容没有变化。");
      ctx.view = ctx.commit({ kind: "field", path, before, after: value }, `${fieldLabel(key)}：${value.length > 24 ? `${value.slice(0, 22)}…` : value}`);
      return done(ctx, `已设置${fieldLabel(key)}。`, note, value);
    },
  };

  const setSkills: AgentTool = {
    name: "set_skills",
    label: "整理技能",
    description:
      "整体设置技能列表。groups 每组可带 category（如「前端」）和 items。只能用用户说过的技能。用户手动改过技能时不能调用。",
    parameters: Type.Object({
      groups: Type.Array(
        Type.Object({
          category: Type.Optional(Type.String()),
          items: Type.Array(Type.String()),
        })
      ),
    }),
    execute: async (_id, params) => {
      forbidDuringAction(ctx, "set_skills");
      const note = syncView(ctx);
      if (ctx.protectedFields.has("skills")) throw new ToolRefusal("技能是用户刚手动改的，受保护。");
      const groups = ((params as { groups?: unknown }).groups as Array<{ category?: string; items?: string[] }>) || [];
      const clean = groups
        .map((group) => ({ category: str(group.category), items: (group.items || []).map(str).filter(Boolean) }))
        .filter((group) => group.items.length);
      if (!clean.length) throw new ToolRefusal("至少需要一项技能。");
      for (const item of clean.flatMap((group) => group.items)) requireFacts(ctx, item, "skill");
      const after: unknown = clean.some((group) => group.category)
        ? Object.fromEntries(clean.map((group, index) => [group.category || `其他${index + 1}`, group.items]))
        : clean.map((group) => group.items.join(" / "));
      const model = readBuilder(ctx.view);
      if (model.error) throw new ToolRefusal(`简历头部 YAML 有误：${model.error}`);
      const before = getField(model.fields as Record<string, unknown>, ["skills"]);
      ctx.view = ctx.commit({ kind: "field", path: ["skills"], before, after }, "整理技能");
      return done(ctx, "已更新技能。", note);
    },
  };

  const addEntry: AgentTool = {
    name: "add_entry",
    label: "新增经历",
    description:
      "在分区里新增一段经历（分区不存在会自动创建）。heading 格式：「公司或项目 | 职位 | YYYY.MM - YYYY.MM」。bullets 可选，每条一句。",
    parameters: Type.Object({
      section: Type.String({ description: "分区名，如 工作经历 / 项目经历 / 教育经历" }),
      heading: Type.String(),
      bullets: Type.Optional(Type.Array(Type.String())),
    }),
    execute: async (_id, params) => {
      forbidDuringAction(ctx, "add_entry");
      const note = syncView(ctx);
      const input = params as { section?: unknown; heading?: unknown; bullets?: unknown[] };
      const sectionTitle = str(input.section);
      const heading = str(input.heading).replace(/^#+\s*/, "");
      const bullets = (input.bullets || []).map(cleanBullet).filter(Boolean);
      if (!sectionTitle || !heading) throw new ToolRefusal("section 和 heading 都不能为空。");
      requireFacts(ctx, heading, "heading");
      for (const bullet of bullets) {
        requireFacts(ctx, bullet, "bullet");
        requireNotRemoved(ctx, `- ${bullet}`);
      }
      requireNotRemoved(ctx, `### ${heading}`);
      const model = parseDoc(ctx.view);
      const section = findSection(model, sectionTitle);
      if (section && findEntry(section, heading)) {
        throw new ToolRefusal(`「${entryOrganization(heading)}」已经在「${section.title}」里了，请用 add_bullet 补充。`);
      }
      const block = ["", `### ${heading}`, ...(bullets.length ? ["", ...bullets.map((b) => `- ${b}`)] : [])];
      const edit: ResumeEdit = section
        ? { kind: "lines", scope: { section: section.title }, before: [], after: block }
        : { kind: "lines", scope: {}, before: [], after: ["", `## ${sectionTitle}`, ...block] };
      ctx.view = ctx.commit(edit, `新增经历 · ${entryOrganization(heading)}`);
      return done(ctx, `已新增经历「${entryOrganization(heading)}」。`, note, block.join("\n"));
    },
  };

  const updateHeading: AgentTool = {
    name: "update_entry_heading",
    label: "修改经历标题",
    description: "修改一段经历的标题行（公司 | 职位 | 时间）。",
    parameters: Type.Object({
      section: Type.String(),
      entry: Type.String({ description: "现有标题或公司名" }),
      heading: Type.String({ description: "新的完整标题" }),
    }),
    execute: async (_id, params) => {
      forbidDuringAction(ctx, "update_entry_heading");
      const note = syncView(ctx);
      const input = params as Record<string, unknown>;
      const heading = str(input.heading).replace(/^#+\s*/, "");
      if (!heading) throw new ToolRefusal("heading 不能为空。");
      const model = parseDoc(ctx.view);
      const section = sectionOrThrow(model, str(input.section));
      const entry = entryOrThrow(section, str(input.entry));
      const oldLine = model.lines[entry.line];
      requireUnprotected(ctx, oldLine);
      requireFacts(ctx, heading, "heading");
      const newLine = `### ${heading}`;
      requireNotRemoved(ctx, newLine);
      if (normalizeLine(oldLine) === normalizeLine(newLine)) return ok("标题没有变化。");
      ctx.view = ctx.commit(
        { kind: "lines", scope: { section: section.title }, before: [oldLine], after: [newLine] },
        `修改经历标题 · ${entryOrganization(heading)}`
      );
      return done(ctx, "已修改标题。", note, heading);
    },
  };

  const addBullet: AgentTool = {
    name: "add_bullet",
    label: "新增要点",
    description:
      "给一段经历（或没有经历的分区）新增一条要点。一句话；缺的数字写「待补：…」。after_text 可指定插在哪条要点后面，默认追加到最后。",
    parameters: Type.Object({
      section: Type.String(),
      entry: Type.Optional(Type.String({ description: "经历标题或公司名；分区本身没有经历时省略" })),
      text: Type.String(),
      after_text: Type.Optional(Type.String()),
    }),
    execute: async (_id, params) => {
      forbidDuringAction(ctx, "add_bullet");
      const note = syncView(ctx);
      const input = params as Record<string, unknown>;
      const text = cleanBullet(input.text);
      if (!text) throw new ToolRefusal("text 不能为空。");
      requireFacts(ctx, text, "bullet");
      const line = `- ${text}`;
      requireNotRemoved(ctx, line);
      const model = parseDoc(ctx.view);
      const sectionTitle = str(input.section);
      const entryQuery = str(input.entry);
      const section = findSection(model, sectionTitle);
      if (!section) {
        if (entryQuery) sectionOrThrow(model, sectionTitle);
        ctx.view = ctx.commit({ kind: "lines", scope: {}, before: [], after: ["", `## ${sectionTitle}`, "", line] }, `新增要点 · ${sectionTitle}`);
        return done(ctx, "已新增要点。", note, text);
      }
      const entry = entryQuery ? entryOrThrow(section, entryQuery) : null;
      const blocks = entry ? entry.blocks : section.blocks;
      const scope: EditScope = entry ? { section: section.title, entry: entry.heading } : { section: section.title };
      if (blocks.some((block) => block.type === "bullet" && normalizeLine(block.text) === normalizeLine(text))) {
        return ok("这条要点已经存在。");
      }
      const label = `新增要点 · ${entry ? entryOrganization(entry.heading) : section.title}`;
      const anchorText = cleanBullet(input.after_text);
      if (anchorText) {
        const anchor = findBullet(model, section.title, entry?.heading || "", anchorText);
        const anchorLine = model.lines[anchor.block.line];
        ctx.view = ctx.commit({ kind: "lines", scope: anchor.scope, before: [anchorLine], after: [anchorLine, `${anchor.block.prefix}${text}`] }, label);
        return done(ctx, "已新增要点。", note, text);
      }
      const last = blocks.filter((block) => block.type !== "hidden").at(-1);
      const after = last && last.type === "bullet" ? [line] : ["", line];
      ctx.view = ctx.commit({ kind: "lines", scope, before: [], after }, label);
      return done(ctx, "已新增要点。", note, text);
    },
  };

  const rewriteBullet: AgentTool = {
    name: "rewrite_bullet",
    label: "改写要点",
    description: "把一条现有要点改写成新的一句。old_text 必须是这条要点当前的原文。",
    parameters: Type.Object({
      section: Type.String(),
      entry: Type.Optional(Type.String()),
      old_text: Type.String(),
      new_text: Type.String(),
    }),
    execute: async (_id, params) => {
      const note = syncView(ctx);
      const input = params as Record<string, unknown>;
      const oldText = cleanBullet(input.old_text);
      const newText = cleanBullet(input.new_text);
      if (!oldText || !newText) throw new ToolRefusal("old_text 和 new_text 都不能为空。");
      const targeted = isActionTarget(ctx, oldText);
      if (ctx.action && !targeted) throw new ToolRefusal("这一轮只能改用户选中的那一条要点。");
      const model = parseDoc(ctx.view);
      const hit = findBullet(model, str(input.section), str(input.entry), oldText);
      const oldLine = model.lines[hit.block.line];
      if (!targeted) requireUnprotected(ctx, oldLine);
      requireFacts(ctx, newText, "bullet");
      const newLine = `${hit.block.prefix}${newText}`;
      requireNotRemoved(ctx, newLine);
      if (normalizeLine(oldLine) === normalizeLine(newLine)) return ok("内容没有变化。");
      const where = hit.scope.entry ? entryOrganization(hit.scope.entry) : hit.scope.section;
      ctx.view = ctx.commit({ kind: "lines", scope: hit.scope, before: [oldLine], after: [newLine] }, `改写要点 · ${where}`);
      return done(ctx, "已改写。", note, newText);
    },
  };

  const removeBullet: AgentTool = {
    name: "remove_bullet",
    label: "删除要点",
    description: "删除一条要点（例如和别的要点重复）。用户手动写的要点不能删。",
    parameters: Type.Object({
      section: Type.String(),
      entry: Type.Optional(Type.String()),
      text: Type.String(),
    }),
    execute: async (_id, params) => {
      forbidDuringAction(ctx, "remove_bullet");
      const note = syncView(ctx);
      const input = params as Record<string, unknown>;
      const model = parseDoc(ctx.view);
      const hit = findBullet(model, str(input.section), str(input.entry), cleanBullet(input.text));
      const line = model.lines[hit.block.line];
      requireUnprotected(ctx, line);
      const previous = model.lines[hit.block.line - 1] ?? "";
      const where = hit.scope.entry ? entryOrganization(hit.scope.entry) : hit.scope.section;
      ctx.view = ctx.commit({ kind: "lines", scope: hit.scope, before: [previous, line], after: [previous] }, `删除要点 · ${where}`);
      return done(ctx, "已删除。", note);
    },
  };

  if (ctx.action?.action === "hint") return [readResume, getRules];
  if (ctx.action) return [readResume, getRules, rewriteBullet];
  return [readResume, getRules, setProfile, setSkills, addEntry, updateHeading, addBullet, rewriteBullet, removeBullet];
}
