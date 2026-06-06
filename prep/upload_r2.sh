#!/usr/bin/env bash
# Upload the ASH Image Bank images to Cloudflare R2, preserving the source tree
# so object keys match prep/build_feed.py's KEY MAPPING CONTRACT (verified layout):
#
#   <DATA_DIR>/collection/<id>/<id>.jpg                  -> <bucket>/collection/<id>/<id>.jpg
#   <DATA_DIR>/atlas/<id>/<id>.jpg                       -> <bucket>/atlas/<id>/<id>.jpg
#   <DATA_DIR>/reference-cases/<id>/images/<img>.jpg     -> <bucket>/reference-cases/<id>/images/<img>.jpg
#
# Only *.jpg are uploaded (index.jsonl, caption.txt, metadata.json, page.html are skipped).
# Objects get immutable, long-lived cache headers (these images never change).
#
# Credentials: reads ../.env (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID)
# and auto-configures the rclone `r2:` remote if it isn't already set up. So you only
# need to fill in .env — no manual `rclone config` step.
#
# Usage (defaults shown; override via env if needed):
#   ./prep/upload_r2.sh            # real upload  (DATA_DIR + REMOTE default for this project)
#   DRY_RUN=1 ./prep/upload_r2.sh  # preview only
set -euo pipefail

# --- Load .env from the repo root (one dir up from prep/) ---------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a; . "$ROOT/.env"; set +a
fi

DATA_DIR="${DATA_DIR:-$HOME/ash-image-bank/data}"
REMOTE="${REMOTE:-r2:hematok-img}"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${R2_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID in .env}}"
CACHE="${CACHE:-public, max-age=31536000, immutable}"
TRANSFERS="${TRANSFERS:-32}"
CHECKERS="${CHECKERS:-64}"

# --- Auto-configure the rclone R2 remote from .env creds if missing -----------
if ! rclone listremotes 2>/dev/null | grep -q '^r2:'; then
  if [[ -n "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" ]]; then
    echo "[upload_r2] configuring rclone remote 'r2' from .env"
    rclone config create r2 s3 \
      provider Cloudflare \
      access_key_id "$R2_ACCESS_KEY_ID" \
      secret_access_key "$R2_SECRET_ACCESS_KEY" \
      endpoint "https://${ACCOUNT_ID}.r2.cloudflarestorage.com" \
      acl private >/dev/null
  else
    echo "[upload_r2] ERROR: no rclone 'r2:' remote and no R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY in .env" >&2
    exit 1
  fi
fi

DRY=()
[[ "${DRY_RUN:-0}" == "1" ]] && DRY=(--dry-run)

echo "[upload_r2] DATA_DIR=$DATA_DIR  REMOTE=$REMOTE  dry_run=${DRY_RUN:-0}"
echo "[upload_r2] jpg count under DATA_DIR: $(find "$DATA_DIR" -type f -name '*.jpg' | wc -l | tr -d ' ')"

rclone copy "$DATA_DIR" "$REMOTE" \
  --include "**.jpg" \
  --header-upload "Cache-Control: $CACHE" \
  --transfers "$TRANSFERS" --checkers "$CHECKERS" \
  --progress --stats-one-line "${DRY[@]}"

echo "[upload_r2] done. Verify with:  rclone size $REMOTE  &&  rclone lsf $REMOTE | head"
