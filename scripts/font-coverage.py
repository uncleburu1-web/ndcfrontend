#!/usr/bin/env python3
"""Spec 21 §11: snapshot which characters each self-hosted font file really has (src/assets/font-coverage.json), for
`npm run check:fonts`. Run again after changing a font file:  python3 scripts/font-coverage.py  (needs fontTools, brotli)."""
import json
import re
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
css = (ROOT / "src/styles/base.css").read_text(encoding="utf-8")
out = {}
for url in re.findall(r'url\("([^"]+\.woff2)"\)', css):
    path = ROOT / "node_modules" / url if url.startswith("@") else (ROOT / "src/styles" / url).resolve()
    cmap = TTFont(str(path)).getBestCmap()
    out[url] = sorted(cmap)
(ROOT / "src/assets/font-coverage.json").write_text(json.dumps(out, separators=(",", ":")) + "\n", encoding="utf-8")
print({k: len(v) for k, v in out.items()})
