# plan-for-deploy-r2.md — Upload Hematok images to R2 & go live

**Audience:** a Claude Code agent running **on the machine that holds the ~1.3 GB image data**
(the box with `index.jsonl` + `collection/` + `reference-cases/` + `atlas/`).

**You are finishing a project that is already 80% done on another machine.** Don't redesign it.
Your job: get the real image bytes into Cloudflare R2 under the exact keys the frontend expects,
then deploy. Everything below has been smoke-tested end-to-end against a 22-record mock; you are
running the same, proven pipeline against the full dataset.

---

## 0. What's already built (on the other machine, committed to the repo)

- `prep/build_feed.py` — turns `index.jsonl` → `frontend/public/feed.json` (the feed the app loads).
  Already run against the real `index.jsonl`: **6,973 records, 7,950 image keys, 0 key collisions.**
- `prep/upload_r2.sh` — the rclone uploader you will run (this doc drives it).
- `frontend/` — forked WikiTok, rewired to render image cards from `feed.json`. Builds clean,
  renders, multi-image cases work. It loads images from `${VITE_IMG_BASE}/<key>`.
- `mock-data/` — a tiny schema mirror used for the smoke test (ignore it; it's not your data).

**What's left = this document:** upload real images to R2, then deploy the frontend.

---

## 1. THE KEY MAPPING CONTRACT (verified — do not deviate)

`build_feed.py` already wrote `feed.json` with image keys that **mirror your source tree**, and the
mapping has been **verified against your actual files** (`~/ash-image-bank/data`): all 7,950 keys in
`feed.json` resolve to real files on disk, 0 missing. The upload MUST place bytes at exactly these
keys or images 404:

| Source file (`~/ash-image-bank/data/`)               | R2 object key                               |
|------------------------------------------------------|---------------------------------------------|
| `collection/<id>/<id>.jpg`                           | `collection/<id>/<id>.jpg`                  |
| `atlas/<id>/<id>.jpg`                                 | `atlas/<id>/<id>.jpg`                        |
| `reference-cases/<id>/images/<imgid>.jpg`            | `reference-cases/<id>/images/<imgid>.jpg`   |

Each `collection`/`atlas` image dir also holds `caption.txt`, `metadata.json`, `page.html`; each
reference-case holds `page.html`. Those sidecars are **not** uploaded — `--include "**.jpg"` skips
them. `rclone copy <DATA_DIR> <remote:bucket> --include "**.jpg"` reproduces the keys above exactly,
no flattening, no renaming. The frontend builds each URL as `${VITE_IMG_BASE}/${key}`.

> If you ever re-scrape into a different layout, reconcile BOTH sides together: edit `keys_for()` in
> `prep/build_feed.py`, re-run it to regenerate `feed.json`, AND adjust the rclone source so keys
> still match. The invariant is "the key in feed.json == the key in R2."

---

## 2. Create the R2 bucket + public custom domain

Prereqs: a Cloudflare account; `wrangler login` done; a domain on Cloudflare you can subdomain
(e.g. `img.example.com`). Ask the human for the domain + account if unknown — don't guess.

```bash
wrangler r2 bucket create hematok-img
```

Attach a **public custom domain** so the browser can load images directly (R2 egress is free):
- Cloudflare dashboard → R2 → `hematok-img` → Settings → **Public access → Custom Domains** →
  add `img.example.com`. (CLI alternative: `wrangler r2 bucket domain add hematok-img --domain img.example.com`.)
- This yields `https://img.example.com/<key>`. That host becomes `VITE_IMG_BASE` in §6.

> Public bucket serving via custom domain is enough for `<img>` tags. You only need CORS rules if
> the app later reads pixels via `fetch`/`<canvas>` — it doesn't today.

---

## 3. Configure rclone for R2

You need an R2 **S3 API token** (R2 → Manage API Tokens → create; gives an access key id + secret)
and your **account id**. Then create the remote non-interactively:

```bash
ACCOUNT_ID=<your-account-id>
rclone config create r2 s3 \
  provider Cloudflare \
  access_key_id <R2_ACCESS_KEY_ID> \
  secret_access_key <R2_SECRET_ACCESS_KEY> \
  endpoint "https://${ACCOUNT_ID}.r2.cloudflarestorage.com" \
  acl private
rclone lsd r2:                      # sanity: should list hematok-img
```
(Keep these secrets in env/your shell, not in the repo.)

---

## 4. Upload (dry-run, then for real)

`prep/upload_r2.sh` uploads only `*.jpg`, preserving the tree, with immutable cache headers.

```bash
cd <repo root>                          # where prep/ lives
DATA_DIR="$HOME/ash-image-bank/data"    # contains collection/ atlas/ reference-cases/  (7,950 jpgs)

# 4a. Preview: confirm file count (~7,950 jpgs) and that paths look right
DATA_DIR="$DATA_DIR" REMOTE=r2:hematok-img DRY_RUN=1 ./prep/upload_r2.sh 2>&1 | tail -20

# 4b. Real upload (~1.3 GB; ingress to R2 is free; resumable — safe to re-run)
DATA_DIR="$DATA_DIR" REMOTE=r2:hematok-img ./prep/upload_r2.sh
```

Re-running is idempotent: rclone skips objects whose size+modtime already match.

---

## 5. Verify upload completeness (cross-check against feed.json)

Every image key in `feed.json` must exist in the bucket. This script lists the bucket once and diffs:

```bash
cd <repo root>
rclone lsf r2:hematok-img --files-only -R > /tmp/r2-keys.txt    # all keys in bucket

python3 - <<'PY'
import json
expected = {k for r in json.load(open("frontend/public/feed.json")) for k in r["images"]}
got = set(open("/tmp/r2-keys.txt").read().split())
missing = expected - got
print(f"expected keys: {len(expected)}   in bucket: {len(got)}")
print(f"missing from bucket: {len(missing)}")
for k in list(missing)[:20]:
    print("  MISSING", k)
PY
```
Expected: `expected keys: 7950`, `missing from bucket: 0`. Investigate any missing keys (usually a
source file that didn't exist, or a layout mismatch from §1). Spot-check one in a browser:
`https://img.example.com/collection/<some-id>.jpg` should render.

---

## 6. Deploy the frontend (Cloudflare Pages)

`feed.json` is already committed and ships as a static asset — no backend.

```bash
cd frontend
echo "VITE_IMG_BASE=https://img.example.com" >  .env.production
echo "VITE_FEED_URL=/feed.json"              >> .env.production
bun install
bun run build            # outputs dist/
```

Deploy `frontend/dist/` to Cloudflare Pages (or Netlify/any static host):
```bash
wrangler pages deploy dist --project-name hematok
```

Set the same two env vars in the Pages project's build settings if you build in CI rather than locally.

---

## 7. Acceptance checklist

- [ ] §1 layout verified (or `build_feed.py` + rclone paths reconciled and `feed.json` regenerated).
- [ ] `wrangler r2 bucket create hematok-img` done; `img.<domain>` custom domain attached.
- [ ] Dry-run showed ~7,950 jpgs; real upload completed without errors.
- [ ] §5 cross-check prints `missing from bucket: 0`.
- [ ] A pasted `https://img.<domain>/collection/<id>.jpg` renders in a browser.
- [ ] `frontend` built with `VITE_IMG_BASE=https://img.<domain>` and deployed.
- [ ] Public URL: endless scroll of real hematology images; tap reveals title/category/author;
      the 134 reference-cases swipe as in-card galleries; image bytes load straight from R2
      (Network tab: requests go to `img.<domain>`, not the app host).

---

## 8. Notes / gotchas

- **Reference-cases zips:** `reference-cases/<case>/case_*.zip` are the original downloads — the
  uploader's `--include "**.jpg"` skips them. Leave them out of R2.
- **Collisions:** `build_feed.py` reported 0 duplicate keys across all 7,950 images, so the
  mirror-tree scheme is safe. If you ever flatten keys instead, re-check for collisions first.
- **Cache busting:** images are immutable (`max-age=31536000, immutable`). If you ever replace an
  image's bytes under the same key, purge that path in Cloudflare or version the key.
- **Re-handoff:** if you changed `build_feed.py`/`feed.json`, commit it so the deployed frontend
  ships the regenerated feed.
