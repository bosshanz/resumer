import React from "react";
import type { TemplateProps } from "./base";
import { collectionThemes } from "./collection";
import { Folio } from "./folio";

export const ledgerDefaultTheme = collectionThemes.ledger;
export function LedgerTemplate(props: TemplateProps) {
  return <Folio {...props} variant="ledger" />;
}
