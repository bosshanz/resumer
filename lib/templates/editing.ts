import type { ReactNode } from "react";
import type { PluggableList } from "unified";

/**
 * 可编辑渲染钩子。模板默认（预览、PDF）不传，输出与原来完全一致；
 * AI 共创在同一套模板上传入它，给正文块和基本信息挂上编辑入口，
 * 这样“边写边看”的就是最终成品的样式，而不是另一套仿制样式。
 */
export type EditableBlockKind = "li" | "h3" | "p";
export type EditableField = "name" | "title" | "summary";

export interface ResumeEditing {
  /**
   * 正文块的附加属性（data-*、事件、tabIndex 等）。
   * source 是交给 ResumeMarkdown 的那段 Markdown，startLine / endLine 是块在其中的 0 基行号。
   * 返回 undefined 表示这一块不可编辑，按原样渲染。
   */
  blockProps(kind: EditableBlockKind, source: string, startLine: number, endLine: number): Record<string, unknown> | undefined;
  /** 基本信息字段的附加属性 */
  fieldProps(field: EditableField): Record<string, unknown>;
  /** 渲染字段文字（例如把「待补」显示成可填写的标记）；value 为空时渲染占位 */
  fieldText(field: EditableField, value: string | undefined): ReactNode;
  /** 只在编辑时追加的 remark 插件（例如「待补」标记） */
  remarkPlugins: PluggableList;
}
