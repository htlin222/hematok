#!/usr/bin/env python3
"""Split feed.json into vision-review batches for per-image morphology notes.

Each batch file lists records (id, title, category path, original description with the
old regex-appended "如何一眼認出" blurbs stripped, absolute image paths). A worker reads
every image and writes prep/morph/out/<id>.json; records whose output already exists are
skipped, so the queue is resumable.

Usage:
  python3 prep/morph_queue.py [--data ~/ash-image-bank/data] [--per-batch 30]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FEED = ROOT / "frontend/public/feed.json"
MORPH = ROOT / "prep/morph"
BLURB = "如何一眼認出"


def original_description(desc: str | None) -> str:
    """Drop the lines apply_high_yield.py appended (generic, keyword-matched blurbs)."""
    kept = [ln for ln in (desc or "").split("\n") if not ln.startswith(BLURB)]
    return "\n".join(kept).strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(Path.home() / "ash-image-bank/data"))
    ap.add_argument("--per-batch", type=int, default=30, help="max images per batch")
    args = ap.parse_args()

    data = Path(args.data)
    out_dir = MORPH / "out"
    q_dir = MORPH / "queue"
    out_dir.mkdir(parents=True, exist_ok=True)
    q_dir.mkdir(parents=True, exist_ok=True)
    for old in q_dir.glob("batch_*.json"):
        old.unlink()

    feed = json.loads(FEED.read_text())
    pending = [r for r in feed if not (out_dir / f"{r['id']}.json").exists()]

    batches: list[list[dict]] = []
    cur: list[dict] = []
    n_img = 0
    for r in pending:
        imgs = [str(data / k) for k in r["images"]]
        if cur and n_img + len(imgs) > args.per_batch:
            batches.append(cur)
            cur, n_img = [], 0
        cur.append({
            "id": r["id"],
            "title": r["title"],
            "category": " > ".join(r["cats"]),
            "description": original_description(r.get("description"))[:2500],
            "images": imgs,
            "out": str(out_dir / f"{r['id']}.json"),
        })
        n_img += len(imgs)
    if cur:
        batches.append(cur)

    for i, b in enumerate(batches):
        (q_dir / f"batch_{i:04d}.json").write_text(json.dumps(b, ensure_ascii=False, indent=1))
    print(f"{len(pending)} pending records / {len(feed)} -> {len(batches)} batches in {q_dir}")


if __name__ == "__main__":
    main()
