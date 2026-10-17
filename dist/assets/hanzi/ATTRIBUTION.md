# Chinese embroidery stroke data

This directory contains a modified subset of the **graphics.txt** data from
[Make Me a Hanzi](https://github.com/skishore/makemeahanzi), created by Skishore
and contributors. Upstream graphics are derived from **Arphic PL KaitiM GB** and
**Arphic PL UKai**, Copyright (c) 1999 Arphic Technology Co., Ltd., and distributed
under the **Arphic Public License**. See `ARPHIC-PUBLIC-LICENSE.txt` and the
upstream `COPYING.txt` supplied here. Dictionary data is not included.

Modification made for this embroidery app on 2026-10-17: only stroke centerline
medians are retained; coordinates are normalized from the 1024-unit upward-y
source into a 100-unit downward-y cell, rounded to 0.1 units, and split into 256
JSON buckets using the character's codepoint modulo 256. These are open
centerline paths for sewing, not typeface outlines. The modified data is also
distributed under the Arphic Public License. The source checksum and asset
counts are recorded in `manifest.json`; `scripts/build-hanzi-data.py` rebuilds
the files. The Latin handwriting in `dist/latin-strokes.js` was created for this
app and is not derived from the Arphic fonts.
