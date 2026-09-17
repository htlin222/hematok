#!/usr/bin/env python3
"""Queue high-yield records for slide-exam pearls (prep/morph/exam/<id>.json).

Input per record: title, category, the finished morph note (already grounded in the image)
and the image paths. Only records whose note has high_yield=true and match != discordant are
queued; records whose exam file already exists are skipped, so the queue is resumable.

Usage:
  python3 prep/exam_queue.py [--data ~/ash-image-bank/data] [--per-batch 40]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FEED = ROOT / "frontend/public/feed.json"
MORPH = ROOT / "prep/morph"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(Path.home() / "ash-image-bank/data"))
    ap.add_argument("--per-batch", type=int, default=40, help="max records per batch")
    args = ap.parse_args()

    data = Path(args.data)
    exam_dir = MORPH / "exam"
    q_dir = MORPH / "exam_queue"
    exam_dir.mkdir(parents=True, exist_ok=True)
    q_dir.mkdir(parents=True, exist_ok=True)
    for old in q_dir.glob("batch_*.json"):
        old.unlink()

    pending = []
    for r in json.loads(FEED.read_text()):
        note_path = MORPH / "out" / f"{r['id']}.json"
        if not note_path.exists() or (exam_dir / f"{r['id']}.json").exists():
            continue
        note = json.loads(note_path.read_text())
        if not note["high_yield"] or note["match"] == "discordant":
            continue
        pending.append({
            "id": r["id"],
            "title": r["title"],
            "category": " > ".join(r["cats"]),
            "note": str(note_path),
            "images": [str(data / k) for k in r["images"]],
            "out": str(exam_dir / f"{r['id']}.json"),
        })

    batches = [pending[i:i + args.per_batch] for i in range(0, len(pending), args.per_batch)]
    for i, b in enumerate(batches):
        (q_dir / f"batch_{i:04d}.json").write_text(json.dumps(b, ensure_ascii=False, indent=1))
    print(f"{len(pending)} pending high-yield records -> {len(batches)} batches in {q_dir}")


if __name__ == "__main__":
    main()
