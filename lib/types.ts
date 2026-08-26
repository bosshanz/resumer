import { z } from "zod";
import { resumeSkillsSchema } from "./skills";

export const contactSchema = z.object({
  phone: z.coerce.string().optional(),
  email: z.coerce.string().optional(),
  website: z.coerce.string().optional(),
  github: z.coerce.string().optional(),
  linkedin: z.coerce.string().optional(),
  location: z.coerce.string().optional(),
});

export const resumeFrontmatterSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  contact: contactSchema.optional(),
  // 基本信息：自由键值（性别/学历/出生年月等），键名即展示标签
  basics: z.record(z.string(), z.coerce.string()).optional(),
  skills: resumeSkillsSchema,
});

export type ResumeFrontmatter = z.infer<typeof resumeFrontmatterSchema>;

// theme 值会被拼进 PDF 渲染的 <style> 与模板内联样式，只放行安全的 CSS 片段
// （颜色、长度、字体名等）；不合法的值在保存/导出时被丢弃，模板回退到默认值。
const safeCssValue = /^[\p{L}\p{N}\s\-#%(),./'"]*$/u;

const safeCssString = z
  .string()
  .regex(safeCssValue)
  .optional()
  .catch(undefined);

export const themeVariablesSchema = z.object({
  primaryColor: safeCssString,
  secondaryColor: safeCssString,
  backgroundColor: safeCssString,
  textColor: safeCssString,
  fontFamily: safeCssString,
  headingFontFamily: safeCssString,
  baseFontSize: safeCssString,
  lineHeight: z.union([z.number(), z.string().regex(safeCssValue)]).optional().catch(undefined),
  marginTop: safeCssString,
  marginBottom: safeCssString,
  marginLeft: safeCssString,
  marginRight: safeCssString,
  photoLayout: z.enum(["default", "floating-monolith"]).optional(),
}).catchall(z.union([z.string(), z.number(), z.boolean()]));

export type ThemeVariables = z.infer<typeof themeVariablesSchema>;

export interface ParsedResume {
  frontmatter: ResumeFrontmatter;
  body: string;
  frontmatterError?: string;
}

export interface Resume {
  id: string;
  userId: string;
  title: string;
  content: string;
  templateId: string;
  themeVariables: ThemeVariables;
  photo?: string;
  /** 变体溯源：指向最初的母本；母本本身为空 */
  parentId?: string;
  /** 变体的来源说明，例如改写时的 JD 首行摘要 */
  originNote?: string;
  createdAt: string;
  updatedAt: string;
}

export const defaultResumeContent = `---
name: 张三
title: 高级前端工程师
summary: 8 年 Web 开发经验，专注于 React 生态与工程化，热爱开源与技术分享。
contact:
  phone: 138****8888
  email: zhangsan@example.com
  github: github.com/zhangsan
  website: zhangsan.dev
basics:
  性别: 男
  学历: 本科
skills:
  - React / Next.js
  - TypeScript
  - Node.js
  - Tailwind CSS
  - Docker / Kubernetes
---

## 工作经历

### 某某科技 | 高级前端工程师 | 2021.06 - 至今

- 负责核心交易链路前端架构，支撑日均千万级 UV。
- 推动组件库建设，覆盖 30+ 业务线，研发效率提升 40%。
- 主导 Next.js 全栈迁移，首屏加载时间降低 60%。

### 某某信息 | 前端工程师 | 2018.07 - 2021.05

- 负责企业级 SaaS 平台前端开发。
- 设计并实现低代码表单引擎，支持复杂业务规则配置。

## 项目经历

### 开源组件库 xyz-ui

- GitHub Stars: 2.3k
- 基于 React + TypeScript 的轻量级组件库，支持无障碍访问与主题定制。

## 教育背景

### 某某大学 | 计算机科学与技术 | 2014.09 - 2018.06
`;
