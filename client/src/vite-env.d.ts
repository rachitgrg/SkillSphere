/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin when hosted separately from the SPA, e.g. https://api.example.com. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
