import { MinimalTemplate } from "./minimal";
import { EditorialTemplate } from "./editorial";
import { LedgerTemplate } from "./ledger";
import { AuthorityTemplate } from "./authority";
import { BlueprintTemplate } from "./blueprint";
import type { TemplateProps } from "./base";
import type { ThemeVariables } from "../types";
import { collectionThemes, type CollectionId } from "./collection";
import { legacyDefaults } from "./legacy-defaults";
import { transitionTheme } from "../theme-transition";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  component: React.FC<TemplateProps>;
  defaultTheme: ThemeVariables;
  preview: {
    fontFamily: string;
    accent: string;
    bg: string;
    fg: string;
    flavor:
      | "serif"
      | "sans"
      | "mono-accent"
      | "grid"
      | "italic"
      | "executive"
      | "compact";
  };
}
const definitions: [
  CollectionId,
  string,
  string,
  React.FC<TemplateProps>,
  TemplateDefinition["preview"]["flavor"],
][] = [
  [
    "minimal",
    "留白",
    "舒展单栏 · 衬线姓名与轻盈留白，适合通用与专业岗位",
    MinimalTemplate,
    "serif",
  ],
  [
    "editorial",
    "纸刊",
    "杂志分栏 · 经历主栏与右侧资料栏，适合设计、内容与创意",
    EditorialTemplate,
    "italic",
  ],
  [
    "ledger",
    "序列",
    "瑞士编号 · 清晰的章节索引与精密层级，适合产品与资深技术",
    LedgerTemplate,
    "grid",
  ],
  [
    "authority",
    "沉静",
    "居中名帖 · 松墨色与舒展正文，适合管理、咨询与商务",
    AuthorityTemplate,
    "executive",
  ],
  [
    "blueprint",
    "构筑",
    "技术档案 · 墨蓝页首与左侧资料栏，适合工程与系统岗位",
    BlueprintTemplate,
    "mono-accent",
  ],
];
export const templates: TemplateDefinition[] = definitions.map(
  ([id, name, description, component, flavor]) => ({
    id,
    name,
    description,
    component,
    defaultTheme: collectionThemes[id],
    preview: {
      fontFamily: String(collectionThemes[id].headingFontFamily),
      accent: String(collectionThemes[id].primaryColor),
      bg: String(collectionThemes[id].backgroundColor),
      fg: String(collectionThemes[id].textColor),
      flavor,
    },
  }),
);
export const retiredTemplateIds: Record<string, CollectionId> = {
  tech: "blueprint",
  developer: "blueprint",
  grid: "ledger",
  executive: "authority",
  compact: "minimal",
};
export function getTemplate(id: string): TemplateDefinition | undefined {
  return templates.find((t) => t.id === (retiredTemplateIds[id] ?? id));
}
export function getDefaultTheme(id: string): ThemeVariables {
  return getTemplate(id)?.defaultTheme || templates[0].defaultTheme;
}
/** One resolver for editor, preview and PDF; old IDs remain readable without a DB migration. */
export function resolveTemplateSettings(
  id: string,
  saved: ThemeVariables = {},
) {
  const template = getTemplate(id) ?? templates[0];
  const themeVariables =
    saved.collectionVersion === 2
      ? { ...template.defaultTheme, ...saved }
      : transitionTheme(
          saved,
          legacyDefaults[id] ?? {},
          template.defaultTheme,
          true,
        );
  return {
    template,
    themeVariables: {
      ...themeVariables,
      collectionVersion: 2,
    } as ThemeVariables,
  };
}
