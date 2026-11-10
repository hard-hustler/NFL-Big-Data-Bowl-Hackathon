"""Map every player in the dashboard to an NFL headshot (nflverse rosters, 2021).

nflverse's `gsis_it_id` is the NGS `nflId` used in the Big Data Bowl files. Only the image id is
stored; the frontend requests a face-cropped thumbnail from the NFL image CDN.
    .venv/bin/python scripts/export_headshots.py [roster_2021.csv]

Writes frontend/public/data/headshots.json: {nfl_id: image_id}.
"""
import json
import sys
from pathlib import Path

import pandas as pd

ROSTER = sys.argv[1] if len(sys.argv) > 1 else "https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_2021.csv"
DATA = Path(__file__).resolve().parents[1] / "data"
OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "data" / "headshots.json"

r = pd.read_csv(ROSTER, usecols=["gsis_it_id", "headshot_url"]).dropna()
r = r.drop_duplicates("gsis_it_id", keep="last")
r["image_id"] = r.headshot_url.str.extract(r"/league/([^/?#]+)$")[0]
r = r.dropna(subset=["image_id"])

ids = set(pd.read_parquet(DATA / "akit_roster.parquet").nfl_id) - {0}
r = r[r.gsis_it_id.astype(int).isin(ids)]
OUT.write_text(json.dumps({str(int(k)): v for k, v in zip(r.gsis_it_id, r.image_id)}, separators=(",", ":")))
print(f"wrote {OUT} ({len(r)} of {len(ids)} players, {OUT.stat().st_size / 1e3:.0f} KB)")
