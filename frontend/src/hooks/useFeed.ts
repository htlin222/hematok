import { useState, useCallback, useRef } from "react";
import type { FeedItem } from "../types/feed";
import { FEED_URL, REC_URL, imgUrl } from "../types/feed";

const PAGE_SIZE = 8;
const REC_PER_PAGE = 6; // recommended cards per page; the rest are random exploration
const LIKES_KEY = "likedImages"; // written by LikedArticlesContext
const DISLIKES_KEY = "dislikedImages"; // written by LikedArticlesContext

function shuffle<T>(input: T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const preloadImage = (src: string): Promise<void> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });

function storedIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return (JSON.parse(raw) as Array<{ id: string }>).map((x) => x.id).filter(Boolean);
  } catch {
    return [];
  }
}
const likedIds = () => storedIds(LIKES_KEY);
const dislikedIds = () => storedIds(DISLIKES_KEY);

/**
 * Loads the whole feed once, then serves an endless scroll. When the user has
 * ♡-liked anything, each new page is mostly semantic recommendations (from the
 * Vectorize Worker, seeded by those likes) interleaved with a little random
 * exploration. With no likes — or if the Worker is unreachable — it falls back
 * to a plain random shuffle.
 */
export function useFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const byId = useRef<Map<string, FeedItem>>(new Map());
  const pool = useRef<FeedItem[]>([]); // shuffled exploration pool
  const cursor = useRef(0);
  const seen = useRef<Set<string>>(new Set());
  const loaded = useRef(false);
  const fetching = useRef(false);

  const ensureLoaded = useCallback(async () => {
    if (loaded.current) return;
    const res = await fetch(FEED_URL);
    if (!res.ok) throw new Error(`feed fetch failed: ${res.status}`);
    const data = (await res.json()) as FeedItem[];
    const valid = data.filter((d) => d.images && d.images.length > 0);
    byId.current = new Map(valid.map((d) => [d.id, d]));
    pool.current = shuffle(valid);
    loaded.current = true;
  }, []);

  // Ask the Worker for ids similar to what the user liked (excluding seen).
  const recommend = useCallback(async (n: number): Promise<FeedItem[]> => {
    const liked = likedIds();
    if (!REC_URL || liked.length === 0) return [];
    try {
      const res = await fetch(`${REC_URL}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked, disliked: dislikedIds(), seen: [...seen.current], n }),
      });
      if (!res.ok) return [];
      const { ids } = (await res.json()) as { ids?: string[] };
      if (!ids?.length) return [];
      return ids
        .map((id) => byId.current.get(id))
        .filter((it): it is FeedItem => !!it && !seen.current.has(it.id));
    } catch {
      return [];
    }
  }, []);

  // Pull the next N unseen items from the shuffled exploration pool.
  const nextRandom = useCallback((n: number): FeedItem[] => {
    const out: FeedItem[] = [];
    const disliked = new Set(dislikedIds());
    let guard = 0;
    while (out.length < n && guard < pool.current.length * 2) {
      if (cursor.current >= pool.current.length) {
        pool.current = shuffle(pool.current);
        cursor.current = 0;
      }
      const it = pool.current[cursor.current++];
      guard++;
      if (it && !seen.current.has(it.id) && !disliked.has(it.id)) out.push(it);
    }
    return out;
  }, []);

  const fetchArticles = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    try {
      await ensureLoaded();

      const recs = await recommend(REC_PER_PAGE);
      const explore = nextRandom(PAGE_SIZE - recs.length);
      // interleave so it doesn't feel like two stacked blocks
      const next: FeedItem[] = [];
      const a = recs, b = explore;
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (i < a.length) next.push(a[i]);
        if (i < b.length) next.push(b[i]);
      }
      next.forEach((it) => seen.current.add(it.id));

      await Promise.allSettled(next.map((it) => preloadImage(imgUrl(it.images[0]))));
      setItems((prev) => [...prev, ...next]);
    } catch (err) {
      console.error("Error loading feed:", err);
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, [ensureLoaded, recommend, nextRandom]);

  return { items, loading, fetchArticles };
}
