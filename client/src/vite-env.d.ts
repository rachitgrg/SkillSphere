/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin when hosted separately from the SPA, e.g. https://api.example.com. */
  readonly VITE_API_URL?: string;
  /** Optional TURN relay for calls across strict NATs (see src/config.ts). */
  readonly VITE_TURN_URL?: string;
  readonly VITE_TURN_USERNAME?: string;
  readonly VITE_TURN_CREDENTIAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
