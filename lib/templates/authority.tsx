import React from "react";
import type { TemplateProps } from "./base";
import { collectionThemes } from "./collection";
import { Folio } from "./folio";

export const authorityDefaultTheme = collectionThemes.authority;
export function AuthorityTemplate(props: TemplateProps) {
  return <Folio {...props} variant="authority" />;
}
