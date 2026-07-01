import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedCard } from "../types/feed";
import { imageUrl } from "../types/feed";

const FEED_URL = import.meta.env.VITE_FEED_URL ?? "/feed.json";
const PAGE = 10;

const preloadImage = (src: string): Promise<void> =>
  new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });

/**
 * Loads the whole feed once (it's small — a few MB of JSON) and pages through
 * it client-side. Base order is the deterministic `rand` shuffle from the
 * builder. Phase D will rerank this in place from IndexedDB engagement scores.
 */
export function useFeed() {
  const pool = useRef<FeedCard[]>([]);
  const cursor = useRef(0);
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appendNext = useCallback(async () => {
    if (loading || cursor.current >= pool.current.length) return;
    setLoading(true);
    const next = pool.current.slice(cursor.current, cursor.current + PAGE);
    cursor.current += next.length;
    // preload the first image of each incoming card before showing it
    await Promise.all(next.map((c) => (c.images[0] ? preloadImage(imageUrl(c.images[0])) : Promise.resolve())));
    setCards((prev) => [...prev, ...next]);
    setLoading(false);
  }, [loading]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(FEED_URL);
        if (!res.ok) throw new Error(`feed ${res.status}`);
        const data: FeedCard[] = await res.json();
        if (cancelled) return;
        pool.current = [...data].sort((a, b) => a.rand - b.rand);
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // load the first page once the pool is ready
  useEffect(() => {
    if (ready && cards.length === 0) void appendNext();
  }, [ready, cards.length, appendNext]);

  return { cards, loading, ready, error, loadMore: appendNext, total: pool.current.length };
}
