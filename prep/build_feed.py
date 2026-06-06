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
import html as htmllib
import json
import re
import sys
from pathlib import Path


def _strip_to_text(fragment: str) -> str:
    """HTML fragment -> readable plain text, preserving paragraph breaks."""
    s = re.sub(r"(?is)</p\s*>", "\n\n", fragment)
    s = re.sub(r"(?is)<br\s*/?>", "\n", s)
    s = re.sub(r"(?s)<[^>]+>", "", s)  # drop remaining tags (img, a, strong, sub, p-open, div)
    s = htmllib.unescape(s)
    s = re.sub(r"[ \t ]+", " ", s)
    s = re.sub(r"\n[ \t]+", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


# Junk that must never appear inside an extracted description (guards against
# grabbing nav/ads/template chrome). If a candidate contains any of these we drop it.
_JUNK_MARKERS = (
    "belongs to set",
    "Other images in this set",
    "Advertisement",
    "Loading. Please wait",
    "Download Set",
    "Download reference case",
    "JavaScript is disabled",
    "function(",
    "Main Navigation",
)


def _looks_like_junk(text: str) -> bool:
    return any(m.lower() in text.lower() for m in _JUNK_MARKERS)


def _refcase_desc(html_text: str) -> str:
    """Reference-case clinical write-up: <div class="RefCaseDesc">…</div>."""
    i = html_text.find('<div class="RefCaseDesc">')
    if i < 0:
        return ""
    depth = 0
    end = None
    for m in re.finditer(r"<(/?)div\b[^>]*>", html_text[i:]):  # [^>]*> so end clears the whole tag
        depth += -1 if m.group(1) else 1
        if depth == 0:
            end = i + m.end()
            break
    return _strip_to_text(html_text[i:end] if end else html_text[i : i + 8000])


def _collection_desc(html_text: str, rid: str) -> str:
    """Collection / atlas image description.

    The prose <p>…</p> sit between the metadata block (…Published Date…</div><br/>)
    and the image-specific hidden input <input id='hf_clinical_<id>'>. We anchor the
    END on that exact id so we can never run past this image's own block, then keep
    only paragraphs that read like sentences (drops &nbsp; spacers and one-word tags).
    """
    end_m = re.search(r"<input[^>]*id=['\"]hf_clinical_" + re.escape(rid), html_text)
    if not end_m:
        return ""
    start_m = re.search(r"Published Date.*?</div>\s*<br\s*/?>", html_text[: end_m.start()], re.S)
    if not start_m:
        return ""
    span = html_text[start_m.end() : end_m.start()]
    paras = []
    for raw in re.findall(r"(?is)<p\b[^>]*>(.*?)</p>", span):
        txt = _strip_to_text(raw)
        # keep real prose; drop empties, one-word tags ("Flashcards2018"), and bare
        # link labels ("Reference Case", "Mast cell Leukemia", "Flow cytometry plot")
        if txt and (len(txt) >= 40 or txt.count(" ") >= 4):
            paras.append(txt)
    return "\n\n".join(paras).strip()


def page_html_for(data_dir: Path, rec: dict) -> Path:
    coll = rec.get("collection", "collection")
    rid = rec["id"]
    if "image_ids" in rec:
        return data_dir / "reference-cases" / rid / "page.html"
    if coll == "atlas":
        return data_dir / "atlas" / rid / "page.html"
    return data_dir / "collection" / rid / "page.html"


def extract_description(data_dir: Path, rec: dict) -> str:
    """Best-effort description for any record. Reference-cases use RefCaseDesc;
    collection/atlas use the per-image <p> block. Junk candidates are rejected."""
    p = page_html_for(data_dir, rec)
    if not p.exists():
        return ""
    t = p.read_text(encoding="utf-8", errors="ignore")
    desc = _refcase_desc(t) or _collection_desc(t, rec["id"])
    if not desc or _looks_like_junk(desc):
        return ""
    return desc


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


def build(in_path: Path, out_path: Path, pretty: bool, data_dir: Path) -> None:
    out_records: list[dict] = []
    top_cats: collections.Counter[str] = collections.Counter()
    seen_keys: collections.Counter[str] = collections.Counter()
    shape_b = 0
    no_image = 0
    with_desc = 0

    with in_path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            cats = split_cats(rec.get("category", ""))
            keys = keys_for(rec)
            if "image_ids" in rec:  # reference-case (teaching case with a clinical write-up)
                shape_b += 1
            description = extract_description(data_dir, rec)
            if description:
                with_desc += 1
            if not keys:
                no_image += 1
            for k in keys:
                seen_keys[k] += 1
            if cats:
                top_cats[cats[0]] += 1
            out = {
                "id": rec["id"],
                "title": rec.get("title", ""),
                "author": rec.get("author", ""),
                "cats": cats,
                "url": rec.get("url", ""),
                "collection": rec.get("collection", "collection"),
                "images": keys,
                "views": to_int(rec.get("views")),
                "downloads": to_int(rec.get("downloads")),
                "published_date": rec.get("published_date", ""),
                "size": rec.get("size", ""),
                "rand": round(rand_key(rec["id"]), 6),
            }
            if description:  # only reference-cases carry prose; keep collection records lean
                out["description"] = description
            out_records.append(out)

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
    print(f"  records w/ description: {with_desc} / {len(out_records)} ({100 * with_desc // max(1, len(out_records))}%)")
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
    ap.add_argument(
        "--data-dir",
        dest="data_dir",
        default=None,
        type=Path,
        help="dir holding collection/ atlas/ reference-cases/ (for descriptions); defaults to the index's dir",
    )
    args = ap.parse_args()
    data_dir = args.data_dir or args.in_path.resolve().parent
    build(args.in_path, args.out_path, args.pretty, data_dir)


if __name__ == "__main__":
    main()
