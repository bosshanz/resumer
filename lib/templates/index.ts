import { MinimalTemplate, minimalDefaultTheme } from "./minimal";
import { TechTemplate, techDefaultTheme } from "./tech";
import { DeveloperTemplate, developerDefaultTheme } from "./developer";
import { TemplateProps } from "./base";
import { ThemeVariables } from "../types";

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
    flavor: "serif" | "sans" | "mono-accent";
  };
}

export const templates: TemplateDefinition[] = [
  {
    id: "minimal",
    name: "极简",
    description: "衬线编辑风，留白克制，适合非技术与综合岗位",
    component: MinimalTemplate,
    defaultTheme: minimalDefaultTheme,
    preview: {
      fontFamily: "var(--font-fraunces), serif",
      accent: "#111111",
      bg: "#ffffff",
      fg: "#111111",
      flavor: "serif",
    },
  },
  {
    id: "tech",
    name: "科技",
    description: "深色 banner 加 Plex Mono 标签，工程师骨架",
    component: TechTemplate,
    defaultTheme: techDefaultTheme,
    preview: {
      fontFamily: "var(--font-plex-sans), sans-serif",
      accent: "#ff7a45",
      bg: "#0a3a5c",
      fg: "#fbfaf6",
      flavor: "mono-accent",
    },
  },
  {
    id: "developer",
    name: "开发者",
    description: "项目卡片化，森林绿主色，密度高、信息层级强",
    component: DeveloperTemplate,
    defaultTheme: developerDefaultTheme,
    preview: {
      fontFamily: "var(--font-inter-tight), sans-serif",
      accent: "#2d5a3d",
      bg: "#fbfaf7",
      fg: "#0d2818",
      flavor: "sans",
    },
  },
];

export function getTemplate(id: string): TemplateDefinition | undefined {
  return templates.find((t) => t.id === id);
}

export function getDefaultTheme(id: string): ThemeVariables {
  return getTemplate(id)?.defaultTheme || templates[0].defaultTheme;
}
