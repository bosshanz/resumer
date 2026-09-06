import React from "react";
import type { TemplateProps } from "./base";
import { collectionThemes } from "./collection";
import { Folio } from "./folio";

export const minimalDefaultTheme = collectionThemes.minimal;
export function MinimalTemplate(props: TemplateProps) {
  return <Folio {...props} variant="minimal" />;
}
