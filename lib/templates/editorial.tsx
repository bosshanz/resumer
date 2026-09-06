import React from "react";
import type { TemplateProps } from "./base";
import { collectionThemes } from "./collection";
import { Folio } from "./folio";

export const editorialDefaultTheme = collectionThemes.editorial;
export function EditorialTemplate(props: TemplateProps) {
  return <Folio {...props} variant="editorial" />;
}
