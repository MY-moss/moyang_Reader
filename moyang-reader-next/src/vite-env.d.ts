/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOYANG_DESKTOP_E2E?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __moyangDesktopE2e?: {
    acceptSourceCompletion?: () => void;
    insertSourceText?: (value: string) => void;
    insertWysiwygText?: (value: string) => void;
  };
}

declare const __MOYANG_DESKTOP_E2E__: boolean;
