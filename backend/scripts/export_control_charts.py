"""Aggregate catch-point-control metrics into chart data for the dashboard.

Input: a folder with play_metrics.csv and frame_metrics.csv.gz (same 2021 weeks 1-8 dataset).
    .venv/bin/python scripts/export_control_charts.py <derived-data-dir>

Writes frontend/public/data/control.json with:
  sameSep    completion by separation bin x control third
  joint      separation vs control points + binned completion
  timeline   control / separation / owned area vs time from release, by outcome
  leverage   completion by separation x receiver lead to the catch point (regrouped)
  hypotheses COES by receiver speed and by defender hip angle
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

SRC = Path(sys.argv[1]).expanduser()
OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "data" / "control.json"

df = pd.read_csv(SRC / "play_metrics.csv")
df = df[df.valid_catch_point.astype(bool) & df.sep_release.notna() & df.cpc_release.notna()]


def prop(y: pd.Series) -> dict:
    """Proportion with a Wilson 95% interval."""
    n, p = len(y), float(y.mean())
    z = 1.96
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return {"n": n, "rate": round(p, 4), "lo": round(c - h, 4), "hi": round(c + h, 4)}


def mean_ci(y: pd.Series) -> dict:
    y = y.dropna()
    m, se = float(y.mean()), float(y.std(ddof=1) / np.sqrt(len(y)))
    return {"n": len(y), "mean": round(m, 4), "lo": round(m - 1.96 * se, 4), "hi": round(m + 1.96 * se, 4)}


# Fig 02: within each separation bin, split plays into control thirds.
SEP_BINS = [0, 1, 2, 3, 4, 6, 10, 60]
SEP_LABELS = ["0-1", "1-2", "2-3", "3-4", "4-6", "6-10", "10+"]
d = df.assign(sep_bin=pd.cut(df.sep_release, SEP_BINS, labels=SEP_LABELS))
d["third"] = d.groupby("sep_bin", observed=True).cpc_release.transform(
    lambda s: pd.qcut(s.rank(method="first"), 3, labels=["low", "mid", "high"]))
same_sep = [{"sep": str(b), "third": str(t), **prop(g.complete)} for (b, t), g in d.groupby(["sep_bin", "third"], observed=True)]

# Fig 03: every play as a point plus completion rate in 1 yd x 0.05 bins (>= 20 plays).
j = df[df.sep_release < 15]
points = [[round(a, 2), round(b, 3), int(c)] for a, b, c in zip(j.sep_release, j.cpc_release, j.complete)]
xb, yb = np.arange(0, 15.5, 1.0), np.round(np.arange(0.15, 1.0001, 0.05), 2)
cnt, _, _ = np.histogram2d(j.sep_release, j.cpc_release, bins=[xb, yb])
hit, _, _ = np.histogram2d(j.sep_release, j.cpc_release, bins=[xb, yb], weights=j.complete)
cells = [{"x0": float(xb[i]), "x1": float(xb[i + 1]), "y0": float(yb[k]), "y1": float(yb[k + 1]),
          "n": int(cnt[i, k]), "rate": round(float(hit[i, k] / cnt[i, k]), 3)}
         for i in range(len(xb) - 1) for k in range(len(yb) - 1) if cnt[i, k] >= 20]
joint = {"r": round(float(df[["sep_release", "cpc_release"]].corr().iloc[0, 1]), 3), "points": points, "cells": cells}

# Fig 05: per-frame metrics relative to release, by outcome.
pf = pd.read_csv(SRC / "frame_metrics.csv.gz")
m = pf.merge(df[["game_id", "play_id", "release_rel", "complete"]], on=["game_id", "play_id"])
m["t"] = ((m.rel_frame - m.release_rel) / 10).round(1)
m = m[m.t.between(-1.0, 0.4)]
timeline = {}
for col in ("cpc", "separation", "territory"):
    timeline[col] = [{"t": float(t), "outcome": "complete" if c == 1 else "incomplete", **mean_ci(g[col])}
                     for (t, c), g in m.groupby(["t", "complete"])]

# Fig 08, cleaned: fewer, wider leverage groups so every cell has a usable sample.
LEV_BINS = [-60, -1, 1, 3, 60]
LEV_LABELS = ["Defender closer", "Even (±1 yd)", "Receiver 1–3 yd closer", "Receiver 3+ yd closer"]
SEP2 = [0, 1.5, 3, 5, 60]
SEP2_LABELS = ["<1.5", "1.5–3", "3–5", "5+"]
lv = df.dropna(subset=["leverage_release"]).assign(
    lev=lambda x: pd.cut(x.leverage_release, LEV_BINS, labels=LEV_LABELS),
    sep=lambda x: pd.cut(x.sep_release, SEP2, labels=SEP2_LABELS))
leverage = {"cols": LEV_LABELS, "rows": SEP2_LABELS,
            "cells": [{"sep": str(s), "lev": str(l), **prop(g.complete)} for (s, l), g in lv.groupby(["sep", "lev"], observed=True)]}

# Fig 10: COES by receiver speed at release and by nearest-defender hip angle.
h = df.dropna(subset=["coes"])
speed = pd.cut(h.rec_speed_release * 2.045, [0, 6, 10, 14, 30], labels=["< 6", "6–10", "10–14", "14+"])
hips = pd.cut(h.nd_hip_release, [-0.01, 0.25, 0.75, 1.01], labels=["Backpedaling", "Turning", "Running with hips"])
air = h.groupby(speed, observed=True).air_yards.median()
hypotheses = {
    "speed": [{"label": str(k), "air_yards": round(float(air[k]), 1), **mean_ci(g.coes)} for k, g in h.groupby(speed, observed=True)],
    "hips": [{"label": str(k), **mean_ci(g.coes)} for k, g in h.groupby(hips, observed=True)],
}

out = {"n_plays": int(len(df)), "base_rate": round(float(df.complete.mean()), 4), "sameSep": same_sep, "joint": joint,
       "timeline": timeline, "leverage": leverage, "hypotheses": hypotheses}
OUT.write_text(json.dumps(out, separators=(",", ":")))
print(f"wrote {OUT} ({OUT.stat().st_size / 1e3:.0f} KB), {len(df)} plays")
