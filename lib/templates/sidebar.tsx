import React from "react";
import type { TemplateProps } from "./base";
import { collectionThemes } from "./collection";
import { Folio } from "./folio";

export const sidebarDefaultTheme = collectionThemes.sidebar;
export function SidebarTemplate(props: TemplateProps) {
  return <Folio {...props} variant="sidebar" />;
}
