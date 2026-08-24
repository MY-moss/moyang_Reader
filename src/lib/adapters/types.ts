import type { DocumentKind } from "../../app/types";

export interface DocumentAdapterCapabilities {
  readonly render: boolean;
  readonly edit: boolean;
  readonly exportHtml: boolean;
  readonly exportDocx: boolean;
}

export interface DocumentAdapter {
  readonly id: string;
  readonly kind: DocumentKind;
  readonly extensions: readonly string[];
  readonly capabilities: DocumentAdapterCapabilities;
}
