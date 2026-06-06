# Hematok — frontend

React + TypeScript + Vite + Tailwind app for [Hematok](../README.md). Renders an endless
image feed from `public/feed.json`; image URLs are built as `${VITE_IMG_BASE}/${key}`.

## Env (`.env.production`)

```
VITE_IMG_BASE=https://img.example.com   # R2 public domain serving image bytes
VITE_FEED_URL=/feed.json                 # the feed (shipped as a static asset)
VITE_REC_URL=https://...workers.dev      # recommendation Worker (empty = off)
```

## Develop / build

```bash
bun install
bun run dev      # local dev server
bun run build    # tsc -b && vite build -> dist/
bun run preview  # preview the production build
```

## Structure

```
src/
  App.tsx                    feed + infinite-scroll shell, likes panel
  hooks/useFeed.ts           loads feed.json, shuffles, paginates (endless)
  components/
    HematokCard.tsx          one full-screen card (tap-to-hide, gallery, zoom/details triggers)
    ZoomViewer.tsx           fullscreen pinch/pan image viewer
    DetailsSheet.tsx         full metadata + reference-case clinical description
  contexts/LikedArticlesContext.tsx   localStorage-backed likes
  types/feed.ts              FeedItem shape + imgUrl() helper
```

Forked from [WikiTok](https://github.com/IsaacGemal/wikitok).
