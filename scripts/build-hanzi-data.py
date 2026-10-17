#!/usr/bin/env python3
"""Convert Make Me a Hanzi medians into local, compact single-line stitch data.

python scripts/build-hanzi-data.py --source scripts/makemeahanzi-graphics.tmp
Upstream: https://github.com/skishore/makemeahanzi (graphics.txt only).
The output is a modification of Arphic font data, under Arphic Public License.
No dictionary data or LGPL dependency is used.
"""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

SOURCE_URL = "https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt"
ROOT = Path(__file__).resolve().parents[1]

def build(source, target):
    raw = source.read_bytes()
    notice = ("Modified 2026-10-17: Make Me a Hanzi / Arphic centerline medians; "
              "normalized to 100 units, y inverted, bucketed by codepoint modulo 256. "
              "Copyright (c) 1999 Arphic Technology Co., Ltd. Freely available under "
              "Arphic Public License; see ARPHICPL.TXT and ATTRIBUTION.md. No warranty.")
    buckets = [{"__notice": notice} for _ in range(256)]
    for line in raw.decode("utf-8").splitlines():
        entry = json.loads(line)
        char = entry["character"]
        # 1024 units, upward-pointing y; preserve the source's shared em box.
        strokes = [[[round(x / 10.24, 1), round((900-y) / 10.24, 1)]
                    for x, y in stroke] for stroke in entry["medians"] if len(stroke) >= 2]
        if strokes:
            buckets[ord(char) & 255][char] = strokes
    target.mkdir(parents=True, exist_ok=True)
    total_bytes = 0
    for index, bucket in enumerate(buckets):
        data = json.dumps(bucket, ensure_ascii=False, separators=(",", ":"))
        output = target / f"{index:02x}.json"
        output.write_text(data, encoding="utf-8")
        total_bytes += len(data.encode("utf-8"))
    manifest = {"name":"Make Me a Hanzi stitch medians", "glyphs":sum(len(bucket)-1 for bucket in buckets),
                "shards":256, "bytes":total_bytes, "source":SOURCE_URL,
                "source_sha256":hashlib.sha256(raw).hexdigest(),
                "license":"Arphic Public License", "modified":True, "modified_date":"2026-10-17",
                "modifications":"Only centerline medians retained; coordinates normalized to 100-unit cells, y axis inverted; grouped by Unicode codepoint modulo 256."}
    (target / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "dist/assets/hanzi")
    args = parser.parse_args()
    source = args.source
    if source is None:
        source = ROOT / "scripts/makemeahanzi-graphics.tmp"
        with urlopen(SOURCE_URL, timeout=180) as response:
            source.write_bytes(response.read())
    build(source, args.output)
