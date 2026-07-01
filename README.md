# Hematok

An endless, TikTok-style scroll through the [ASH Image Bank](https://imagebank.hematology.org) —
thousands of hematology & pathology images for study and reference. Forked from
[WikiTok](https://github.com/IsaacGemal/wikitok) and rewired to render image cards from a static
feed, with image bytes served from Cloudflare R2.

- **App:** Cloudflare Pages — `hematok.pages.dev` (custom domain, e.g. `hematok.<your-domain>`)
- **Images:** Cloudflare R2 bucket `hematok-img`, public domain (e.g. `img.<your-domain>`)
- **Recommendations:** Cloudflare Worker + Vectorize + Workers AI (semantic "more like this" from likes)

> Account id, domains, and tokens are **not** committed — set them in `.env` / `frontend/.env.production`
> (copy from the `*.example` files).

## Features

- Vertical snap-scroll feed of 6,973 records / 7,950 images
- Single-tap to hide chrome; fullscreen pinch-zoom viewer for image detail
- Details sheet with full metadata; **134 reference-cases carry the full clinical write-up**
- Multi-image reference-cases swipe as in-card galleries
- PWA (installable, self-updating service worker)

## Layout

```
frontend/            React + Vite + Tailwind app (renders public/feed.json)
  public/feed.json   the feed the app loads (built by prep/build_feed.py)
prep/
  build_feed.py      index.jsonl -> frontend/public/feed.json (+ refcase descriptions)
  upload_r2.sh       rclone uploader -> R2 (reads ../.env, auto-configs the remote)
plan-for-deploy-r2.md  the deploy runbook
.env.example         deploy credentials template (copy to .env; .env is gitignored)
```

The source image tree (`collection/ atlas/ reference-cases/` + `index.jsonl`, ~1.3 GB) lives
**outside** this repo at `~/ash-image-bank/data` and is not committed.

## Build & deploy

```bash
# 1. (re)build the feed from the scrape
python3 prep/build_feed.py --in ~/ash-image-bank/data/index.jsonl --out frontend/public/feed.json

# 2. upload images to R2 (fill .env first — see .env.example)
./prep/upload_r2.sh                    # DRY_RUN=1 to preview

# 3. build + deploy the frontend
cd frontend && bun install && bun run build
wrangler pages deploy dist --project-name hematok
```

The key invariant: **the image key in `feed.json` == the object key in R2**
(`collection/<id>/<id>.jpg`, `atlas/<id>/<id>.jpg`, `reference-cases/<id>/images/<imgid>.jpg`).
See `plan-for-deploy-r2.md` for the full runbook.

## Owner login & server-side history

The site is public and anonymous by default (likes live in `localStorage`).
An **owner login** in the header records like / dislike / read **server-side**
so they persist across devices and steer recommendations. Backend =
Cloudflare **Pages Functions** under `frontend/functions/api/*`, state in KV
(`STATE` binding), config in `frontend/wrangler.toml`. Only
`hsieh.ting.lin@gmail.com` is allowed.

Auth is dual-path: a Cloudflare **Access** email login (designed; needs the
`hematok.pages.dev/api` Access app to be created) **and** an owner **bearer
token** (`OWNER_TOKEN` Pages secret) that works today. See
`docs/plans/2026-07-01-owner-login-design.md` for the full design and the steps
to switch on the Access email login.

## Credits

Images & metadata © the American Society of Hematology and the original contributors.
UI forked from WikiTok by [@Aizkmusic](https://github.com/IsaacGemal/wikitok).
