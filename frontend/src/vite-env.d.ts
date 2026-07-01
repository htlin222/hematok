/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for image objects, e.g. https://img.example.com (prod) or /img (mock). */
  readonly VITE_IMG_BASE?: string;
  /** Override the feed JSON URL. Defaults to /feed.json (prod) ; smoke test uses /feed.mock.json. */
  readonly VITE_FEED_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
