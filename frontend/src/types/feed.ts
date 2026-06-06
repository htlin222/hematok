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
  description?: string; // clinical narrative — reference-cases only
  rand: number;
}

const IMG_BASE = (import.meta.env.VITE_IMG_BASE ?? "").replace(/\/$/, "");
export const FEED_URL = import.meta.env.VITE_FEED_URL ?? "/feed.json";
// Recommendation Worker (semantic "more like this" from your ♡ likes). Empty = disabled.
export const REC_URL = (import.meta.env.VITE_REC_URL ?? "").replace(/\/$/, "");

// Build the public URL for an image key. Keys already mirror the R2 tree,
// so this is just `${base}/${key}` — the KEY MAPPING CONTRACT in the deploy plan.
export const imgUrl = (key: string): string => `${IMG_BASE}/${key}`;
