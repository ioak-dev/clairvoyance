/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POSTGREST_URL?: string;
  readonly VITE_POSTGREST_JWT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
