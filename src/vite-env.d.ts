/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOYANG_DESKTOP_E2E?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __MOYANG_DESKTOP_E2E__: boolean;
