/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IMG_BASE: string;
  readonly VITE_FEED_URL: string;
  readonly VITE_REC_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
