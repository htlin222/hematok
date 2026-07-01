#!/usr/bin/env python3
"""Regenerate the local smoke-test mock (gitignored artifacts).

Produces, from the real index.jsonl:
  mock-data/index.jsonl                      curated subset (collection + atlas + reference-cases)
  mock-data/<key>.jpg                        placeholder JPEGs at the real R2 key paths (via `magick`)
  frontend/public/feed.mock.json             mock feed (built by build_feed.py)
  frontend/public/img/<key>.jpg              the placeholders, served at VITE_IMG_BASE=/img

Then `cd frontend && bun run dev` (uses .env.development) to smoke-test the feed.

Requires ImageMagick (`magick`) on PATH.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "index.jsonl"
MOCK = ROOT / "mock-data"
PUB = ROOT / "frontend" / "public"


def curate() -> list[dict]:
    recs = [json.loads(l) for l in SRC.open() if l.strip()]
    collection = [r for r in recs if r.get("collection") == "collection"][:18]
    atlas = [r for r in recs if r.get("collection") == "atlas"][:2]
    refcases = [r for r in recs if r.get("collection") == "reference-cases"][:2]
    return collection + atlas + refcases


def color(key: str) -> str:
    return "#" + hashlib.md5(key.encode()).hexdigest()[:6]


def main() -> None:
    subset = curate()
    MOCK.mkdir(exist_ok=True)
    (MOCK / "index.jsonl").write_text(
        "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in subset)
    )

    # build mock feed.json from the subset (reuses the real builder)
    subprocess.run(
        ["python3", str(ROOT / "prep" / "build_feed.py"),
         "--in", str(MOCK / "index.jsonl"), "--out", str(PUB / "feed.mock.json")],
        check=True,
    )

    feed = json.loads((PUB / "feed.mock.json").read_text())
    keys = [k for r in feed for k in r["images"]]
    for r in feed:
        for k in r["images"]:
            dest = MOCK / k
            dest.parent.mkdir(parents=True, exist_ok=True)
            label = f"{r['id']}\n{k.split('/')[0]}"
            subprocess.run(
                ["magick", "-size", "720x720", f"canvas:{color(k)}",
                 "-gravity", "center", "-pointsize", "48", "-fill", "white",
                 "-annotate", "0", label, str(dest)],
                check=True, stderr=subprocess.DEVNULL,
            )

    # stage placeholders under public/img (served at /img by VITE_IMG_BASE)
    img = PUB / "img"
    if img.exists():
        shutil.rmtree(img)
    for sub in ("collection", "atlas", "reference-cases"):
        s = MOCK / sub
        if s.exists():
            shutil.copytree(s, img / sub)

    print(f"mock ready: {len(subset)} records, {len(keys)} placeholder images")
    print("now run:  cd frontend && bun run dev")


if __name__ == "__main__":
    main()
