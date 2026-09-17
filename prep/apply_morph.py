#!/usr/bin/env python3
"""Merge per-image morphology notes (prep/morph/out/<id>.json) into the app.

- feed.json: strips the old keyword-matched "如何一眼認出" blurbs from descriptions,
  sets High_Yield from the vision-reviewed note (records without a note keep their flag).
- frontend/public/morph/<shard>.json: the notes themselves, sharded by Number(id) % SHARDS
  and fetched lazily by the details sheet, so feed.json stays small.

Idempotent; run after build_feed.py and after each batch of notes lands.

Usage:
  python3 prep/apply_morph.py
"""

from __future__ import annotations

import json
from pathlib import Path

from morph_queue import original_description
from morph_validate import check

ROOT = Path(__file__).resolve().parent.parent
FEED = ROOT / "frontend/public/feed.json"
OUT = ROOT / "prep/morph/out"
SHARD_DIR = ROOT / "frontend/public/morph"
SHARDS = 64  # keep in sync with MORPH_SHARDS in frontend/src/types/feed.ts
FIELDS = ("recognize_zh", "features", "describe_en", "ddx", "specimen", "stain", "match", "captions")


def main() -> None:
    notes: dict[str, dict] = {}
    skipped = []
    for p in sorted(OUT.glob("*.json")):
        if check(p):
            skipped.append(p.stem)
            continue
        notes[p.stem] = json.loads(p.read_text())

    feed = json.loads(FEED.read_text())
    shards: list[dict[str, dict]] = [{} for _ in range(SHARDS)]
    for r in feed:
        desc = original_description(r.get("description"))
        if desc:
            r["description"] = desc
        else:
            r.pop("description", None)
        n = notes.get(r["id"])
        if not n:
            continue
        if n["high_yield"]:
            r["High_Yield"] = True
        else:
            r.pop("High_Yield", None)
        r["morph"] = True
        shards[int(r["id"]) % SHARDS][r["id"]] = {k: n[k] for k in FIELDS if k in n}

    FEED.write_text(json.dumps(feed, ensure_ascii=False, separators=(",", ":")))
    SHARD_DIR.mkdir(parents=True, exist_ok=True)
    for i, s in enumerate(shards):
        (SHARD_DIR / f"{i}.json").write_text(json.dumps(s, ensure_ascii=False, separators=(",", ":")))

    print(f"merged {len(notes)} notes into {len(feed)} records; {SHARDS} shards -> {SHARD_DIR}")
    if skipped:
        print(f"skipped {len(skipped)} invalid notes: {' '.join(skipped[:20])}{' ...' if len(skipped) > 20 else ''}")


if __name__ == "__main__":
    main()
