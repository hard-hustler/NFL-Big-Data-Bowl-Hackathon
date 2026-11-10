"""Export every API response to static JSON for the frontend (frontend/public/data).

Run after build_akit.py:
    .venv/bin/python scripts/export_static.py

Writes summary.json, leaderboard.json, players.json, plays/{nfl_id}.json and
play/{game_id}-{play_id}.json. Play payloads are trimmed to 1 s before the snap and
rounded so the whole site deploys as static files.
"""
import asyncio
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import akit  # noqa: E402  (loads the parquet files)

OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "data"
PRE_SNAP = 10  # frames kept before the snap


def dump(path: Path, obj) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, separators=(",", ":"), allow_nan=False)
    path.write_text(text)
    return len(text)


def trim(detail: dict) -> dict:
    """Drop frames long before the snap, shift frame indices, round coordinates."""
    m = detail["meta"]
    start = max(0, m["snap_frame"] - PRE_SNAP)
    for k in ("snap_frame", "release_frame", "arrival_frame"):
        m[k] -= start
    detail["events"] = [{**e, "frame": e["frame"] - start} for e in detail["events"] if e["frame"] >= start]
    for p in detail["players"]:
        p["frames"] = [[round(x, 1), round(y, 1), round(s, 1), round(o), round(d)] for x, y, s, o, d in p["frames"][start:]]
    return detail


async def main():
    shutil.rmtree(OUT, ignore_errors=True)
    total = dump(OUT / "summary.json", await akit.summary())
    total += dump(OUT / "leaderboard.json", await akit.leaderboard())
    receivers = await akit.players()
    total += dump(OUT / "players.json", receivers)
    for r in receivers:
        total += dump(OUT / "plays" / f"{r['nfl_id']}.json", await akit.plays(r["nfl_id"], contested=False, limit=10_000))
    keys = akit.PLAYS[["game_id", "play_id"]].itertuples(index=False)
    for i, (g, p) in enumerate(keys):
        total += dump(OUT / "play" / f"{g}-{p}.json", trim(await akit.play(int(g), int(p))))
        if i % 1000 == 0:
            print(f"{i} plays, {total / 1e6:.1f} MB", flush=True)
    print(f"done: {total / 1e6:.1f} MB in {OUT}")


asyncio.run(main())
