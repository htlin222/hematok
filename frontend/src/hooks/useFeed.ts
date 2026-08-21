import { useState, useCallback, useRef } from "react";
import type { RefObject } from "react";
import type { FeedItem } from "../types/feed";
import { FEED_URL, REC_URL, imgUrl } from "../types/feed";

const PAGE_SIZE = 8;
const REC_PER_PAGE = 6; // recommended cards per page; the rest are random exploration
const LIKES_KEY = "likedImages"; // written by LikedArticlesContext
const DISLIKES_KEY = "dislikedImages"; // written by LikedArticlesContext
const READ_KEY = "readImages"; // ids of cards already scrolled into view

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
// Read ids are stored as a plain string[] (not {id} objects), so read directly.
function readIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? (JSON.parse(raw) as string[]).filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Loads the whole feed once, then serves an endless scroll. Each page of local
 * exploration cards appears instantly (the pool lives in memory); semantic
 * recommendations (from the Vectorize Worker, seeded by ♡ likes) are fetched
 * in parallel and spliced into the not-yet-seen part of the feed when they
 * arrive. With no likes — or if the Worker is unreachable — the feed is just
 * the random shuffle, and scrolling never waits on the network.
 *
 * `anchorId` points at the card currently in view (maintained by the caller);
 * recommendations are inserted after it so the splice never shifts scroll.
 */
export function useFeed(anchorId?: RefObject<string | null>) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const byId = useRef<Map<string, FeedItem>>(new Map());
  const pool = useRef<FeedItem[]>([]); // shuffled exploration pool
  const cursor = useRef(0);
  const seen = useRef<Set<string>>(new Set());
  const loaded = useRef(false);
  const fetching = useRef(false);
  const recInFlight = useRef(false);

  const ensureLoaded = useCallback(async () => {
    if (loaded.current) return;
    const res = await fetch(FEED_URL);
    if (!res.ok) throw new Error(`feed fetch failed: ${res.status}`);
    const data = (await res.json()) as FeedItem[];
    const valid = data.filter((d) => d.images && d.images.length > 0);
    byId.current = new Map(valid.map((d) => [d.id, d]));
    pool.current = shuffle(valid);
    // Exclude everything already read (server-hydrated on login, or local) so
    // the feed doesn't re-surface seen cards across sessions or devices.
    for (const id of readIds()) seen.current.add(id);
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

  // Splice freshly arrived recommendations into the part of the feed the user
  // hasn't reached yet, interleaved with the existing tail so they don't sit
  // as one block. Inserting after the anchor (+1 card of slack) means the card
  // under the user's thumb never moves.
  const insertRecs = useCallback(
    (recs: FeedItem[]) => {
      if (recs.length === 0) return;
      recs.forEach((it) => seen.current.add(it.id));
      recs.forEach((it) => preloadImage(imgUrl(it.images[0]))); // warm cache
      setItems((prev) => {
        const fresh = recs.filter((r) => !prev.some((p) => p.id === r.id));
        if (fresh.length === 0) return prev;
        const ci = anchorId?.current
          ? prev.findIndex((x) => x.id === anchorId.current)
          : -1;
        const insertAt = Math.min(prev.length, ci + 2);
        const head = prev.slice(0, insertAt);
        const tail = prev.slice(insertAt);
        const merged: FeedItem[] = [];
        for (let i = 0; i < Math.max(fresh.length, tail.length); i++) {
          if (i < fresh.length) merged.push(fresh[i]);
          if (i < tail.length) merged.push(tail[i]);
        }
        return [...head, ...merged];
      });
    },
    [anchorId]
  );

  const fetchArticles = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    try {
      await ensureLoaded();

      // Local exploration cards go up immediately — once feed.json is in,
      // scrolling never waits on the network. Each card lazy-loads its own
      // image (pulse placeholder → fade-in); preloading here just warms the
      // cache without blocking.
      const next = nextRandom(PAGE_SIZE);
      next.forEach((it) => seen.current.add(it.id));
      next.forEach((it) => preloadImage(imgUrl(it.images[0])));
      setItems((prev) => [...prev, ...next]);

      // Recommendations arrive whenever they arrive (at most one request in
      // flight) and are spliced in behind the user's position.
      if (!recInFlight.current) {
        recInFlight.current = true;
        recommend(REC_PER_PAGE)
          .then(insertRecs)
          .finally(() => {
            recInFlight.current = false;
          });
      }
    } catch (err) {
      console.error("Error loading feed:", err);
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, [ensureLoaded, recommend, nextRandom, insertRecs]);

  const getRandomItems = useCallback((n: number, excludeId: string): FeedItem[] => {
    if (!loaded.current) return [];
    const out: FeedItem[] = [];
    const copy = [...pool.current];
    let i = 0;
    while (out.length < n && i < copy.length) {
      if (copy[i].id !== excludeId) out.push(copy[i]);
      i++;
    }
    return out;
  }, []);

  return { items, loading, fetchArticles, getRandomItems };
}
