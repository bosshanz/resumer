import React from "react";
import type { TemplateProps } from "./base";
import { collectionThemes } from "./collection";
import { Folio } from "./folio";

export const blueprintDefaultTheme = collectionThemes.blueprint;
export function BlueprintTemplate(props: TemplateProps) {
  return <Folio {...props} variant="blueprint" />;
}
