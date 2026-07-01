/** One image card in the feed, as emitted by prep/build_feed.py. */
export interface FeedCard {
  id: string;
  title: string;
  author: string;
  /** category taxonomy, leaf-last, segments trimmed */
  cats: string[];
  /** ASH Image Bank page URL */
  url: string;
  collection: string;
  /** R2 object keys, mirroring the source tree (e.g. "collection/66486.jpg") */
  images: string[];
  views: number;
  downloads: number;
  /** stable shuffle key in [0,1) */
  rand: number;
}

const IMG_BASE = (import.meta.env.VITE_IMG_BASE ?? "").replace(/\/$/, "");

/** Build the full URL for an R2 image key. */
export function imageUrl(key: string): string {
  return `${IMG_BASE}/${key}`;
}
