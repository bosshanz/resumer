import React from "react";
import type { TemplateProps } from "./base";
import { collectionThemes } from "./collection";
import { Folio } from "./folio";

export const scholarDefaultTheme = collectionThemes.scholar;
export function ScholarTemplate(props: TemplateProps) {
  return <Folio {...props} variant="scholar" />;
}
