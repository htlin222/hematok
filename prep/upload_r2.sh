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
# Prereqs: rclone configured with an R2 remote (see plan-for-deploy-r2.md §3).
#
# Usage:
#   DATA_DIR=/path/to/data REMOTE=r2:hematok-img ./prep/upload_r2.sh            # real upload
#   DATA_DIR=/path/to/data REMOTE=r2:hematok-img DRY_RUN=1 ./prep/upload_r2.sh  # preview only
set -euo pipefail

DATA_DIR="${DATA_DIR:?set DATA_DIR to the dir containing collection/ atlas/ reference-cases/}"
REMOTE="${REMOTE:?set REMOTE to your rclone R2 target, e.g. r2:hematok-img}"
CACHE="${CACHE:-public, max-age=31536000, immutable}"
TRANSFERS="${TRANSFERS:-32}"
CHECKERS="${CHECKERS:-64}"

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
