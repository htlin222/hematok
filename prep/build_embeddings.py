#!/usr/bin/env python3
"""Embed every feed record with Workers AI (bge-small, 384-dim) and upsert into
the Vectorize index `hematok-rec`. Powers semantic "more like this" recommendations.

Auth: uses $CLOUDFLARE_API_TOKEN if set, else the wrangler OAuth token.
Embedding text = title + category path + description (the richest signal we have).

Usage:
  python3 prep/build_embeddings.py [--feed frontend/public/feed.json] [--index hematok-rec]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import tomllib
import urllib.request
from pathlib import Path

EMBED_MODEL = "@cf/baai/bge-small-en-v1.5"
EMBED_BATCH = 100
UPSERT_BATCH = 1000
ACCT = ""  # set in main() from CLOUDFLARE_ACCOUNT_ID


def load_dotenv() -> None:
    """Load KEY=VALUE pairs from the repo-root .env into os.environ (if present)."""
    env = Path(__file__).resolve().parent.parent / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def account_id() -> str:
    a = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or os.environ.get("R2_ACCOUNT_ID")
    if not a:
        sys.exit("set CLOUDFLARE_ACCOUNT_ID in .env (Cloudflare account id)")
    return a


def token() -> str:
    t = os.environ.get("CLOUDFLARE_API_TOKEN")
    if t:
        return t
    cfg = tomllib.load(open(os.path.expanduser("~/Library/Preferences/.wrangler/config/default.toml"), "rb"))
    return cfg["oauth_token"]


def api(method: str, path: str, body=None, ndjson: str | None = None, tok: str = "") -> dict:
    if ndjson is not None:
        data = ndjson.encode()
        ctype = "application/x-ndjson"
    else:
        data = json.dumps(body).encode() if body is not None else None
        ctype = "application/json"
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/{path}",
        data=data, method=method,
        headers={"Authorization": f"Bearer {tok}", "Content-Type": ctype},
    )
    for attempt in range(6):
        try:
            return json.load(urllib.request.urlopen(req, timeout=60))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 520, 522) and attempt < 5:
                time.sleep(2 ** attempt)
                continue
            return {"_http": e.code, "_body": e.read().decode()[:300]}
        except Exception as e:  # noqa: BLE001 — connection reset / timeout / SSL: retry
            if attempt < 5:
                time.sleep(2 ** attempt)
                continue
            return {"_err": repr(e)}
    return {"_http": "retry-exhausted"}


def text_for(rec: dict) -> str:
    parts = [rec.get("title", "").strip()]
    if rec.get("cats"):
        parts.append(" > ".join(rec["cats"]))
    if rec.get("description"):
        parts.append(rec["description"][:1200])
    return ". ".join(p for p in parts if p)


def embed(texts: list[str], tok: str) -> list[list[float]]:
    r = api("POST", f"ai/run/{EMBED_MODEL}", body={"text": texts}, tok=tok)
    if not r.get("success"):
        raise RuntimeError(f"embed failed: {r}")
    return r["result"]["data"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", default="frontend/public/feed.json", type=Path)
    ap.add_argument("--index", default="hematok-rec")
    ap.add_argument("--out", default="prep/embeddings.ndjson", type=Path)
    args = ap.parse_args()

    global ACCT
    load_dotenv()
    ACCT = account_id()
    tok = token()
    recs = json.load(open(args.feed))
    print(f"[embed] {len(recs)} records")

    # 1. embed in batches, write NDJSON {id, values, metadata}
    lines: list[str] = []
    for i in range(0, len(recs), EMBED_BATCH):
        chunk = recs[i : i + EMBED_BATCH]
        vecs = embed([text_for(r) for r in chunk], tok)
        for rec, v in zip(chunk, vecs):
            lines.append(json.dumps({
                "id": rec["id"],
                "values": [round(x, 6) for x in v],
                "metadata": {"collection": rec.get("collection", ""), "hasDesc": bool(rec.get("description"))},
            }))
        print(f"\r[embed] {min(i + EMBED_BATCH, len(recs))}/{len(recs)}", end="", flush=True)
    print()
    args.out.write_text("\n".join(lines))
    print(f"[embed] wrote {args.out} ({args.out.stat().st_size // 1024} KB)")

    # 2. upsert into Vectorize in batches
    upserted = 0
    for i in range(0, len(lines), UPSERT_BATCH):
        batch = "\n".join(lines[i : i + UPSERT_BATCH])
        r = api("POST", f"vectorize/v2/indexes/{args.index}/upsert", ndjson=batch, tok=tok)
        if not r.get("success"):
            print(f"\n[upsert] FAILED at {i}: {r}", file=sys.stderr)
            sys.exit(1)
        upserted += min(UPSERT_BATCH, len(lines) - i)
        print(f"\r[upsert] {upserted}/{len(lines)} (mutation {r['result'].get('mutationId','?')[:12]})", end="", flush=True)
    print(f"\n[embed] done — {upserted} vectors upserted into {args.index}")


if __name__ == "__main__":
    main()
