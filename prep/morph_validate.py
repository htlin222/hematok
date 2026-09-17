#!/usr/bin/env python3
"""Validate prep/morph/out/<id>.json (morph notes) or prep/morph/exam/<id>.json (--exam).

Usage:
  python3 prep/morph_validate.py [--exam] [ID ...]   # no ids = validate everything present
Exit code 1 if any file fails; prints one line per problem.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent / "morph/out"
EXAM = Path(__file__).resolve().parent / "morph/exam"
SPECIMENS = {"PB", "BM aspirate", "BM biopsy", "LN", "spleen", "tissue", "body fluid",
             "CSF", "flow", "cytogenetics", "molecular", "gross", "radiology", "clinical photo", "other"}
MATCH = {"consistent", "partial", "discordant", "non-morphologic"}


def check(path: Path) -> list[str]:
    try:
        d = json.loads(path.read_text())
    except Exception as e:  # noqa: BLE001
        return [f"invalid JSON: {e}"]
    errs: list[str] = []

    def s(key: str, lo: int, hi: int) -> None:
        v = d.get(key)
        if not isinstance(v, str) or not (lo <= len(v) <= hi):
            errs.append(f"{key}: expected str len {lo}-{hi}, got {type(v).__name__} len {len(v) if isinstance(v, str) else '-'}")

    if d.get("id") != path.stem:
        errs.append(f"id mismatch: {d.get('id')!r}")
    s("recognize_zh", 15, 260)
    s("describe_en", 80, 1400)
    s("stain", 2, 60)
    if d.get("specimen") not in SPECIMENS:
        errs.append(f"specimen not in enum: {d.get('specimen')!r}")
    if d.get("match") not in MATCH:
        errs.append(f"match not in enum: {d.get('match')!r}")
    if not isinstance(d.get("high_yield"), bool):
        errs.append("high_yield: expected bool")
    f = d.get("features")
    if not (isinstance(f, list) and 2 <= len(f) <= 8 and all(isinstance(x, str) and x for x in f)):
        errs.append("features: expected 2-8 non-empty strings")
    ddx = d.get("ddx")
    if not (isinstance(ddx, list) and len(ddx) <= 5 and all(
            isinstance(x, dict) and isinstance(x.get("dx"), str) and isinstance(x.get("vs"), str) and x["dx"] and x["vs"]
            for x in ddx)):
        errs.append("ddx: expected <=5 {dx, vs} objects")
    caps = d.get("captions")
    if caps is not None and not (isinstance(caps, list) and all(isinstance(c, str) for c in caps)):
        errs.append("captions: expected list of strings")
    return errs


def check_exam(path: Path) -> list[str]:
    try:
        d = json.loads(path.read_text())
    except Exception as e:  # noqa: BLE001
        return [f"invalid JSON: {e}"]
    errs: list[str] = []
    if d.get("id") != path.stem:
        errs.append(f"id mismatch: {d.get('id')!r}")
    a = d.get("answer_en")
    if not (isinstance(a, str) and 10 <= len(a) <= 200):
        errs.append("answer_en: expected str len 10-200")
    p = d.get("pearls_zh")
    if not (isinstance(p, list) and 3 <= len(p) <= 5 and all(isinstance(x, str) and 8 <= len(x) <= 160 for x in p)):
        errs.append("pearls_zh: expected 3-5 strings, each len 8-160")
    t = d.get("pitfall_zh")
    if not (isinstance(t, str) and 8 <= len(t) <= 160):
        errs.append("pitfall_zh: expected str len 8-160")
    q = d.get("quiz")
    if not (isinstance(q, dict) and all(isinstance(q.get(k), str) and q[k] for k in ("q", "a"))):
        errs.append("quiz: expected {q, a} non-empty strings")
    return errs


def main() -> None:
    ids = sys.argv[1:]
    exam = "--exam" in ids
    ids = [i for i in ids if i != "--exam"]
    base, fn = (EXAM, check_exam) if exam else (OUT, check)
    paths = [base / f"{i}.json" for i in ids] if ids else sorted(base.glob("*.json"))
    bad = 0
    for p in paths:
        if not p.exists():
            print(f"{p.stem}: MISSING")
            bad += 1
            continue
        errs = fn(p)
        if errs:
            bad += 1
            print(f"{p.stem}: " + "; ".join(errs))
    print(f"checked {len(paths)}, failed {bad}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
