import React from "react";
import type { TemplateProps } from "./base";
import { collectionThemes } from "./collection";
import { Folio } from "./folio";

export const precisionDefaultTheme = collectionThemes.precision;
export function PrecisionTemplate(props: TemplateProps) {
  return <Folio {...props} variant="precision" />;
}
