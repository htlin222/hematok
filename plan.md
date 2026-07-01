# plan.md — Hematok (ASH Image Bank doomscroll)

A vertical, TikTok-style infinite feed of hematology images from the **ASH Image Bank**,
built on a fork of **WikiTok** for the UI and a port of **xikipedia's** client-side scoring.

The data is already scraped into `index.jsonl` (one record per image) and the image bytes
already exist (currently on another device). So this is *not* an ingestion-heavy project —
it's "normalize a clean JSONL, host the images, wire the feed, port the scoring."

---

## 0. Conventions for the agent

- Work **phase by phase**. Don't start a phase until the previous phase's acceptance criteria pass.
- After each phase, print what was created/changed and how you verified it.
- The whole index is small (3.5 MB, 6,973 rows). **Default to backend-free** — load/sample/rerank
  in the browser. Only stand up the Worker/D1 path (§A2) if a real reason appears (see Open Decisions).
- Never put image bytes through app CPU — the browser loads images directly from the image host's CDN/domain.
- All per-user personalization lives in the browser (IndexedDB). Nothing leaves the device.
- Host names / bucket names / domains go in `.env` / `wrangler.toml`, never hard-coded in source.
- Ask the user before any destructive bucket op or any bulk re-upload.

---

## 1. The data (`index.jsonl`) — ground truth

6,973 newline-delimited JSON records. **Two shapes:**

**A. Single-image (6,839 records)** — collections `collection` (6,773) and `atlas` (66):
```json
{
  "id": "66486", "collection": "collection",
  "url": "https://imagebank.hematology.org/image/66486/abnormal-promyelocyte-2?type=upload",
  "title": "Abnormal Promyelocyte 2",
  "author": "Smriti Garhwal; Amit Kumar Das; Shilpi Saxena, MD; ...",
  "category": "Myeloid Neoplasms and acute leukemia (WHO 2016) > Acute Myeloid Leukemia > AML with recurrent genetic abnormalities > AML with t(15;17)(q22;q12); PML-RARA (and variants)",
  "published_date": "05/21/2026", "image_number": "66486",
  "views": "247", "downloads": "8", "size": "0.04 MB",
  "image_file": "66486.jpg"
}
```

**B. Multi-image reference-cases (134 records)** — collection `reference-cases`, **no `image_file`**,
instead an `image_ids` array (a teaching case = several photomicrographs):
```json
{
  "id": "148", "collection": "reference-cases",
  "title": "Photomicrographs from a peripheral blood smear displaying prominent platelet satellitism ...",
  "category": "Laboratory Hematology > Basics of automated cell counts > ... > Platelet satellitosis",
  "image_ids": ["64155", "64154", "64153", "64152"],
  "views": "24333", "downloads": "96", ...
}
```

Notes:
- `image_file` is always `"<id>.jpg"` for shape A. For shape B, each member image is `"<image_id>.jpg"`.
- `category` is a `>`-delimited path, **depth 1–7** (dist: 1→578, 2→1568, 3→3348, 4→1297, 5→160, 6→20, 7→2).
  Some segments have stray trailing spaces — **trim every segment**.
- `views` / `downloads` are strings of integers — popularity signal (optional cold-start prior).
- `author` is a messy `;`-joined string; display as-is, don't try to parse.
- There is **no front/back** (these are single images, not flashcards). The "reveal" is metadata
  (title / category / author), not a second face.

---

## 2. Architecture

### A1. Recommended — backend-free (static)

```
index.jsonl ──prep(one-time)──► web/public/feed.json   (normalized, ~1–2 MB gzipped)
images (already scraped) ──────► image host / CDN  (img.<domain>/<id>.jpg, immutable cache)

Browser:
  - loads feed.json once, samples + reranks entirely client-side
  - <img src="https://img.<domain>/<id>.jpg">  (bytes straight from CDN, never through app)
  - IndexedDB: seen-set + per-category scores  (personalization, client-only)
```
Why: 6,973 rows is tiny. SQL random-sampling in a Worker buys nothing a client `Array` can't do,
and WikiTok is already a backend-free SPA. Fewer moving parts, $0 compute, trivial deploy (static host).

### A2. Optional — Worker + D1 (only if §9 forces it)

Keep this in your back pocket for: the index growing 10–100×, server-side tag filtering at scale,
or wanting to hide the full list from the client. Schema + `/feed` endpoint design preserved in
**Appendix A** at the bottom. Do **not** build it unless a listed trigger fires.

---

## 3. Phase A — Data prep (`prep/` — one small script)

Turn `index.jsonl` into a frontend-ready `web/public/feed.json`.

- [ ] `prep/build_feed.py` (stdlib only, no deps):
  1. Read `index.jsonl` line by line.
  2. For each record, emit a normalized object:
     ```json
     {
       "id": "66486",
       "title": "Abnormal Promyelocyte 2",
       "author": "Smriti Garhwal; ...",
       "cats": ["Myeloid Neoplasms and acute leukemia (WHO 2016)", "Acute Myeloid Leukemia", "...", "..."],
       "url": "https://imagebank.hematology.org/image/66486/...",
       "images": ["66486"],          // shape A → [id]; shape B → image_ids
       "collection": "collection",
       "views": 247, "downloads": 8,
       "rand": 0.4172                 // deterministic shuffle key, see below
     }
     ```
  3. `cats` = `category.split(" > ")` with **each segment `.strip()`-ed**, empties dropped.
  4. `images`: shape A → `[id]`; shape B → `image_ids` (preserve order).
  5. `rand`: a stable pseudo-random float in [0,1) per id (e.g. `int(sha1(id)[:8],16)/0xffffffff`)
     so the base feed order is shuffled but reproducible across builds. **Do not** use
     `random()`/wall-clock (keeps rebuilds diff-clean).
  6. Cast `views`/`downloads` to int.
- [ ] Write a compact (no-whitespace) JSON **array** to `web/public/feed.json`.
- [ ] Print: record count, how many shape-B, distinct top-level categories + counts, output size.

**Acceptance:** `feed.json` has 6,973 entries; shape-B entries have multi-element `images`;
`cats` arrays are clean (no empty/whitespace segments); file is committed (or git-ignored if you
prefer to regenerate — decide in §9).

---

## 4. Phase B — Image hosting

The bytes are already scraped (on another device). Goal: make `https://img.<domain>/<id>.jpg` resolve.

- [ ] Decide host (see §9): R2 + custom domain (matches $0-egress goal), or any static/CDN bucket.
- [ ] (Optional) transcode to ~1080px **WebP, q~80** for feed weight — keep originals too. If skipping,
      serve the scraped JPGs as-is.
- [ ] Bulk upload keyed by id: `<id>.jpg` (or `.webp`). For shape-B cases, every `image_id` must exist.
- [ ] Set **immutable, long-lived cache** headers (these images never change).
- [ ] Cross-check: every `images[*]` value in `feed.json` has a corresponding uploaded object.
      Print any missing ids.

**Acceptance:** pasting `https://img.<domain>/66486.jpg` in a browser renders the picture;
the missing-id report is empty (or its gaps are understood/accepted).

---

## 5. Phase C — Frontend feed (`web/` = `frontend/`, forked WikiTok)

Current WikiTok files to deal with (`frontend/src/`):
- **Remove:** `languages.ts`, `components/LanguageSelector.tsx`, `hooks/useLocalization.ts` (no i18n of articles).
- **Replace:** `hooks/useWikiArticles.ts` → `hooks/useFeed.ts`; `components/WikiCard.tsx` → `components/ImageCard.tsx`.
- **Keep & rename:** `contexts/LikedArticlesContext.tsx` → `LikedImagesContext` (like state); the
  scroll-snap container in `ArticleList.tsx`; share/like UI shell; `styles/`, PWA bits.

Work:
- [ ] `useFeed`: on mount, `fetch('/feed.json')` once into memory. Expose a `next(batchSize)` that
      pulls from the (reranked — Phase D) ordering and an `appendOnScroll` cursor. No network per scroll.
- [ ] `ImageCard`: full-bleed `<img src={img(id)}>` where `img(id) = ${VITE_IMG_BASE}/${id}.jpg`.
      - Tap/click reveals a metadata overlay: title, the `cats` breadcrumb, author, link to `url`.
      - **Shape-B (multi-image):** render an in-card horizontally-swipeable gallery over `images`
        (dots indicator). One card = one teaching case. (Alt: explode to N cards — see §9.)
      - Lazy-load; preload the next 1–2 cards' first image.
- [ ] Keep like / skip gestures (buttons or swipe) — they feed Phase D scoring.
- [ ] `.env`: `VITE_IMG_BASE=https://img.<domain>` (no `VITE_API_URL` in the backend-free path).

**Acceptance:** endless scroll of hematology image cards from `feed.json`; tap reveals
title+category+author; multi-image cases swipe within the card; Network tab shows image bytes
coming straight from the image host (never from app JS).

---

## 6. Phase D — Client-side scoring (port of xikipedia `engagePost`)

All state in **IndexedDB**. The **category tree is the signal** (cleaner than Wikipedia categories):
score the **leaf + each ancestor** of a card's `cats`, so liking a specific entity also nudges its
parent topic.

### State
- `seen`: `id → timesSeen`.
- `scores`: `categorySegment → number` (default 0). Key by individual `cats` segments (all levels).
- `postsSinceLastLike`: counter.

### Engagement deltas (port these constants; apply to **every** segment in the card's `cats`)
| Action | Score |
|---|---|
| Scroll past (skip) | −5 |
| Like | 50 + 4 × postsSinceLastLike (then reset counter) |
| Reveal metadata / "open" | +75 |
| Zoom / expand image | +100 |

- **Base score** per card: 0, **+5** (all cards have an image).
- **Seen penalty:** `(3 ** timesSeen − 1) × −5000` — strongly suppresses repeats.
- **Cold start (optional):** seed a small positive prior from `log(views)` so popular images surface
  early before the user has taught the model anything.
- **Dominant-tag damping (optional):** `Laboratory Hematology` and `Myeloid Neoplasms ...` are the two
  biggest top-levels — seed them slightly negative (as xikipedia does for `given names`/`surnames`)
  so they don't drown everything.

### Reranking the in-memory feed
For each candidate card: `cardScore = base + seenPenalty + Σ(scores[seg] for seg in cats)`.
Pick the next card with xikipedia's split:
- ~40%: weighted-random by score (higher → likelier).
- ~42%: highest-scoring unseen card.
- ~18%: fully random (keeps discovery alive).

### Loop
- [ ] Increment `seen[id]` when a card scrolls past; persist `scores` after each engagement.
- [ ] Settings: a **"reset algorithm"** button clearing `scores`/`seen`.
- [ ] (Backend-free path: no `?tags=` round-trip — reranking is fully local over the loaded array.)

**Acceptance:** liking several cards under one category visibly shifts the feed toward that branch
within ~20–30 cards; seen cards rarely reappear; reset restores neutral behavior.

---

## 7. Phase E — Deploy

- [ ] Image host: create bucket → attach `img.<domain>` → immutable cache → bulk upload (Phase B).
- [ ] Build `web/` (`bun run build`) → deploy `dist/` to a static host (Cloudflare Pages / Netlify / etc.).
- [ ] Set `VITE_IMG_BASE` at build time. `feed.json` ships as a static asset in `dist/`.
- [ ] (If §A2 ever used: deploy Worker + D1 per Appendix A and set `VITE_API_URL` instead.)

**Acceptance:** the public URL serves an endless, learning, image doomscroll of the ASH Image Bank;
image egress is $0 (if R2); no compute layer in the hot path.

---

## 8. Build order (checklist)

1. [ ] Phase A — `prep/build_feed.py` → `web/public/feed.json` (count + category report)
2. [ ] Phase B — images reachable at `img.<domain>/<id>.jpg`; missing-id report clean
3. [ ] Phase C — strip Wikipedia code; `useFeed` + `ImageCard`; tap-for-metadata; multi-image gallery
4. [ ] Phase D — IndexedDB seen-tracking + ported scoring + reset button
5. [ ] Phase E — deploy static `web/` + image host

---

## 9. Open decisions (resolve early)

- **Image host:** R2 (+custom domain, $0 egress — matches original intent) vs. any static CDN you already have.
- **Transcode or not:** ship scraped JPGs as-is (simplest) vs. WebP-1080 variants (lighter feed). Sizes are
  already tiny (~0.04 MB many), so transcoding may not be worth it.
- **Multi-image cases (134):** in-card swipeable gallery (preserves "case" semantics — recommended) vs.
  explode each `image_id` into its own card (simpler component, loses the teaching grouping).
- **`feed.json` in git:** commit the generated file (zero-build deploy) vs. git-ignore + regenerate in CI.
- **Backend-free vs Worker/D1:** stay static (A1) unless the index grows 10×+, you need server-side
  filtering at scale, or you must not expose the full list to the client → then build Appendix A.

---

## 10. Licensing / attribution

- `web/` is derived from **WikiTok (MIT)** — keep its LICENSE and attribution.
- Scoring is a **reimplementation** of xikipedia's algorithm (AGPL-3.0) from its documented constants;
  do **not** copy its source files into this repo (avoids AGPL obligations).
- The ASH Image Bank content belongs to ASH / the contributing authors — confirm redistribution terms
  before making images public; at minimum preserve `author`, `title`, and link back to `url` per card.

---

## Appendix A — Worker + D1 (optional, do not build unless §9 triggers)

Only relevant for the scale path. Self-contained reference.

### Schema (`worker/schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS cards (
  id          TEXT PRIMARY KEY,      -- ASH image id
  images      TEXT,                  -- JSON array of image ids
  title       TEXT,
  author      TEXT,
  cats        TEXT,                  -- normalized: " seg1 seg2 " space-padded for LIKE
  url         TEXT,
  collection  TEXT,
  views       INTEGER,
  downloads   INTEGER,
  rand_key    REAL                   -- random float [0,1) for sampling
);
CREATE INDEX IF NOT EXISTS idx_rand ON cards(rand_key);
```

### `GET /feed`
Params: `cursor` (last rand_key, default 0), `tags` (optional comma list), `limit` (default 20, cap 30).
```sql
SELECT id, images, title, author, cats, url, collection, views, downloads, rand_key
FROM cards
WHERE rand_key > ?1
  AND (?2 = '' OR cats LIKE ?3)
ORDER BY rand_key
LIMIT ?4;
```
- Client sends the largest `rand_key` from the previous batch as `cursor`; **wrap** to 0 when a batch
  underfills (endless scroll over a finite set).
- Multiple tags → `(cats LIKE '% a %' OR cats LIKE '% b %')` with bound params.
- Permissive CORS for the web origin; `Cache-Control: public, max-age=60` on `/feed`.
- Image URLs are built client-side from ids (`${VITE_IMG_BASE}/${id}.jpg`) — Worker returns JSON only.
