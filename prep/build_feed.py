#!/usr/bin/env python3
"""Build frontend/public/feed.json from index.jsonl (ASH Image Bank scrape).

Stdlib only. Deterministic output (no wall-clock / RNG) so rebuilds diff clean.

KEY MAPPING CONTRACT (must match the R2 upload — see plan-for-deploy-r2.md)
--------------------------------------------------------------------------
Every image becomes an R2 object whose key MIRRORS the source tree. Verified
against the scrape host (home:~/ash-image-bank/data) — all 7,950 keys exist:

  collection record   -> key  collection/<id>/<id>.jpg
  atlas record        -> key  atlas/<id>/<id>.jpg
  reference-case      -> keys reference-cases/<rec_id>/images/<imgid>.jpg, ...

The frontend builds the URL as  `${VITE_IMG_BASE}/${key}`. `rclone copy <data>
<remote> --include "**.jpg"` reproduces these keys exactly (sidecar
caption.txt/metadata.json/page.html files are skipped). If the layout ever
changes, edit keys_for() below AND the rclone source together.

Usage:
  python3 prep/build_feed.py [--in index.jsonl] [--out frontend/public/feed.json] [--pretty]
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import sys
from pathlib import Path


def rand_key(image_id: str) -> float:
    """Stable pseudo-random float in [0,1) derived from the id (reproducible)."""
    h = hashlib.sha1(image_id.encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def split_cats(category: str) -> list[str]:
    """Split the ' > '-delimited taxonomy; trim each segment, drop empties."""
    return [seg.strip() for seg in category.split(">") if seg.strip()]


def keys_for(rec: dict) -> list[str]:
    """Derive the R2 object key(s) for a record, mirroring the source tree.

    Verified layout on the scrape host (home:~/ash-image-bank/data):
      collection/<id>/<id>.jpg                  (+ caption.txt/metadata.json/page.html sidecars)
      atlas/<id>/<id>.jpg                       (+ same sidecars)
      reference-cases/<id>/images/<imgid>.jpg   (+ page.html)
    """
    coll = rec.get("collection", "collection")
    rid = rec["id"]
    if "image_ids" in rec:  # reference-cases (multi-image teaching case)
        return [f"reference-cases/{rid}/images/{img}.jpg" for img in rec["image_ids"]]
    img = rec.get("image_file")  # single image: "<id>.jpg"
    if not img:
        return []
    if coll == "atlas":
        return [f"atlas/{rid}/{img}"]
    return [f"collection/{rid}/{img}"]


def to_int(v) -> int:
    try:
        return int(str(v).strip())
    except (ValueError, TypeError):
        return 0


def build(in_path: Path, out_path: Path, pretty: bool) -> None:
    out_records: list[dict] = []
    top_cats: collections.Counter[str] = collections.Counter()
    seen_keys: collections.Counter[str] = collections.Counter()
    shape_b = 0
    no_image = 0

    with in_path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            cats = split_cats(rec.get("category", ""))
            keys = keys_for(rec)
            if "image_ids" in rec:
                shape_b += 1
            if not keys:
                no_image += 1
            for k in keys:
                seen_keys[k] += 1
            if cats:
                top_cats[cats[0]] += 1
            out_records.append(
                {
                    "id": rec["id"],
                    "title": rec.get("title", ""),
                    "author": rec.get("author", ""),
                    "cats": cats,
                    "url": rec.get("url", ""),
                    "collection": rec.get("collection", "collection"),
                    "images": keys,
                    "views": to_int(rec.get("views")),
                    "downloads": to_int(rec.get("downloads")),
                    "rand": round(rand_key(rec["id"]), 6),
                }
            )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w") as f:
        if pretty:
            json.dump(out_records, f, ensure_ascii=False, indent=2)
        else:
            json.dump(out_records, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = out_path.stat().st_size / 1024
    dupes = {k: c for k, c in seen_keys.items() if c > 1}

    print(f"[build_feed] wrote {out_path}")
    print(f"  records:        {len(out_records)}")
    print(f"  single-image:   {len(out_records) - shape_b}")
    print(f"  reference-cases:{shape_b}")
    print(f"  records w/o image: {no_image}")
    print(f"  distinct image keys: {len(seen_keys)}  (duplicates: {len(dupes)})")
    print(f"  output size:    {size_kb:.0f} KB")
    print("  top-level categories:")
    for cat, c in top_cats.most_common():
        print(f"    {c:5d}  {cat}")
    if dupes:
        print(
            "  WARNING: duplicate image keys (id collisions across collections):",
            file=sys.stderr,
        )
        for k, c in list(dupes.items())[:10]:
            print(f"    {c}x  {k}", file=sys.stderr)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", default="index.jsonl", type=Path)
    ap.add_argument(
        "--out", dest="out_path", default="frontend/public/feed.json", type=Path
    )
    ap.add_argument(
        "--pretty", action="store_true", help="pretty-print (for inspection)"
    )
    args = ap.parse_args()
    build(args.in_path, args.out_path, args.pretty)


if __name__ == "__main__":
    main()
