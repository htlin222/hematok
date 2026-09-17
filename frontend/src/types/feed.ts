// Shape of one record in /feed.json (produced by prep/build_feed.py).
export interface FeedItem {
  id: string;
  title: string;
  author: string;
  cats: string[];
  url: string; // source page on the ASH Image Bank
  collection: string; // "collection" | "atlas" | "reference-cases"
  images: string[]; // R2 object keys, e.g. "collection/66486/66486.jpg"
  views: number;
  downloads: number;
  published_date?: string;
  size?: string;
  description?: string; // clinical narrative / contributor caption
  High_Yield?: boolean; // classic, commonly tested morphology (from the vision-reviewed note)
  morph?: boolean; // a MorphNote exists in /morph/<shard>.json
  rand: number;
}

// Per-image morphology study note (prep/apply_morph.py), fetched lazily by the details sheet.
export interface MorphNote {
  recognize_zh: string; // 如何認出這張圖
  features: string[];
  describe_en: string; // report-style English description
  ddx: { dx: string; vs: string }[];
  specimen: string;
  stain: string;
  match: "consistent" | "partial" | "discordant" | "non-morphologic";
  captions?: string[]; // one per image, multi-image records only
}

export const MORPH_SHARDS = 64; // keep in sync with SHARDS in prep/apply_morph.py
export const morphUrl = (id: string): string => `/morph/${Number(id) % MORPH_SHARDS}.json`;

const IMG_BASE = (import.meta.env.VITE_IMG_BASE ?? "").replace(/\/$/, "");
export const FEED_URL = import.meta.env.VITE_FEED_URL ?? "/feed.json";
// Recommendation Worker (semantic "more like this" from your ♡ likes). Empty = disabled.
export const REC_URL = (import.meta.env.VITE_REC_URL ?? "").replace(/\/$/, "");

// Build the public URL for an image key. Keys already mirror the R2 tree,
// so this is just `${base}/${key}` — the KEY MAPPING CONTRACT in the deploy plan.
export const imgUrl = (key: string): string => `${IMG_BASE}/${key}`;
