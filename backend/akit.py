"""AKIT endpoints: spatial dominance at the throw (DSV / SICE) for targeted WR/TE/RB."""
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from scipy.stats import rankdata

router = APIRouter(prefix="/api/akit")

DATA = Path(__file__).parent / "data"
KEY = ["game_id", "play_id"]
REACH = 12.0  # yd; defenders farther than this from the target for the whole window are not sent
PRIMARY = 1   # closest defender is drawn; the rest within REACH only feed the space map

# Built by scripts/build_akit.py
PLAYS = pd.read_parquet(DATA / "akit_plays.parquet")
PLAYS["dsv_series"] = PLAYS.dsv_series.map(lambda s: [float(v) for v in s])
OPTIONS = pd.read_parquet(DATA / "akit_options.parquet").set_index(KEY).sort_index()
FRAMES = pd.read_parquet(DATA / "akit_frames.parquet").set_index(KEY).sort_index()
ROSTER = pd.read_parquet(DATA / "akit_roster.parquet").set_index(KEY).sort_index()

C = PLAYS.copy()
C["caught"] = (C.pass_result == "C").astype(float)


def records(df: pd.DataFrame) -> list[dict]:
    out = df.astype(object)
    scalar = [c for c in out.columns if c != "dsv_series"]
    out[scalar] = out[scalar].where(out[scalar].notna(), None)
    return out.to_dict("records")


def _auc(x: np.ndarray, y: np.ndarray) -> float:
    r = rankdata(x)
    n1 = y.sum()
    n0 = y.size - n1
    return float((r[y == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def _ci(fn, *arrays, n: int = 600, seed: int = 11) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    m = arrays[0].size
    vals = []
    for _ in range(n):
        i = rng.integers(0, m, m)
        vals.append(fn(*(a[i] for a in arrays)))
    return float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))


def _rate(g: pd.DataFrame) -> dict:
    y = g.caught.to_numpy()
    lo, hi = _ci(np.mean, y)
    return {"n": int(y.size), "catch": round(y.mean(), 3), "ci_low": round(lo, 3), "ci_high": round(hi, 3),
            "yards": round(float(g.yards_gained.mean()), 2)}


def _summary() -> dict:
    d = C.dropna(subset=["separation_at_pass_forward"])
    y = d.caught.to_numpy()
    preds = [
        ("separation_at_pass_forward", "Separation at the throw", "nearest of 11 defenders"),
        ("dsv_release", "DSV at the throw", "vs all 11 defenders"),
        ("dsv_arrival", "DSV 0.5 s after the throw", "vs all 11 defenders"),
        ("sice", "SICE over the first 0.5 s", "after ÷ at the throw"),
    ]
    auc = []
    for col, label, basis in preds:
        x = d[col].to_numpy()
        lo, hi = _ci(_auc, x, y)
        auc.append({"metric": col, "label": label, "basis": basis, "auc": round(_auc(x, y), 3),
                    "ci_low": round(lo, 3), "ci_high": round(hi, 3)})
    q = pd.qcut(C.dsv_release.rank(method="first"), 4, labels=False)
    quart = [{"q": int(i) + 1, "dsv_lo": float(g.dsv_release.min()), "dsv_hi": float(g.dsv_release.max()), **_rate(g)}
             for i, g in C.groupby(q)]
    split = [{"group": "decay", "label": "Space shrank after the throw (SICE < 1)", **_rate(C[C.sice < 1])},
             {"group": "flat", "label": "Held steady (SICE = 1)", **_rate(C[C.sice == 1])},
             {"group": "expand", "label": "Space grew after the throw (SICE > 1)", **_rate(C[C.sice > 1])}]
    pos = [{"position": p, "n": len(g), "dsv_release": round(g.dsv_release.mean(), 2),
            "dsv_arrival": round(g.dsv_arrival.mean(), 2), "sice_median": round(g.sice.median(), 3),
            "pct_expand": round((g.sice > 1).mean(), 3), "catch": round(g.caught.mean(), 3)}
           for p, g in C.groupby("nfl_position") if len(g) >= 30]
    multi = C[C.n_options >= 2]
    ranks = []
    for k, g in multi.groupby(multi.dsv_rank.clip(upper=4)):
        label = "Most space" if k == 1 else ("4th or lower" if k == 4 else f"{['', '', '2nd', '3rd'][int(k)]} most")
        ranks.append({"rank": int(k), "label": label, **_rate(g)})
    passed = multi[~multi.threw_to_best]
    qb = {"n": len(multi), "pct_best": round(multi.threw_to_best.mean(), 3), "ranks": ranks,
          "gap_median": round(float((passed.best_dsv - passed.dsv_release).median()), 1)}
    rho = float(d[["separation_at_pass_forward", "dsv_release"]].corr("spearman").iloc[0, 1])
    return {"n_plays": len(C), "n_options": int(len(OPTIONS)), "n_games": int(C.game_id.nunique()), "auc": auc,
            "quartiles": quart, "sice_split": split, "positions": pos, "qb": qb, "rho_sep_dsv": round(rho, 3),
            "base_catch": round(C.caught.mean(), 3)}


SUMMARY = _summary()


@router.get("/summary")
async def summary():
    return SUMMARY


@router.get("/leaderboard")
async def leaderboard(min_targets: int = 15, k: float = 15):
    """Receivers ranked by mean DSV at the throw on their targets, shrunk toward the league mean."""
    league = C.dsv_release.mean()
    g = C.groupby(["nfl_id", "display_name", "nfl_position"]).agg(
        targets=("play_id", "size"), dsv=("dsv_release", "mean"), sice=("sice", "median"), catch=("caught", "mean"))
    g = g[g.targets >= min_targets].reset_index()
    g["dsv_shrunk"] = (g.targets * g.dsv + k * league) / (g.targets + k)
    g = g.sort_values("dsv_shrunk", ascending=False)
    return {"league_dsv": round(float(league), 2), "rows": records(g.round(3))}


@router.get("/players")
async def players():
    g = PLAYS.groupby(["nfl_id", "display_name", "nfl_position"]).agg(
        targets=("play_id", "size"), contested=("contested", "sum")).reset_index()
    return records(g.sort_values("targets", ascending=False))


@router.get("/plays")
async def plays(nfl_id: int, contested: bool = False, limit: int = 300):
    df = PLAYS[PLAYS.nfl_id == nfl_id]
    if contested:
        df = df[df.contested]
    df = df.sort_values(["week", "game_id", "play_id"])
    cols = ["game_id", "play_id", "nfl_id", "season", "week", "down", "yards_to_go", "route_ran", "pass_result",
            "yards_gained", "team_coverage_man_zone", "separation_at_pass_forward", "dsv_release", "dsv_arrival",
            "sice", "dsv_series", "def_dist_release", "dsv_rank", "n_options", "best_name", "threw_to_best", "contested"]
    return {"total": len(df), "plays": records(df[cols].head(limit))}


@router.get("/play/{game_id}/{play_id}")
async def play(game_id: int, play_id: int):
    meta = PLAYS[(PLAYS.game_id == game_id) & (PLAYS.play_id == play_id)]
    if meta.empty:
        raise HTTPException(404, "play not found")
    m = meta.iloc[0]
    fr = FRAMES.loc[(game_id, play_id)]
    n = int(fr.frame.max()) + 1
    window = slice(int(m.release_frame), int(m.arrival_frame))
    tracks = {}
    for r in ROSTER.loc[[(game_id, play_id)]].itertuples(index=False):
        p = fr[fr.nfl_id == r.nfl_id].set_index("frame")[["x", "y", "s", "o", "dir"]]
        tracks[r.nfl_id] = (r, p[~p.index.duplicated()].reindex(range(n)).ffill().bfill())
    tgt = tracks[int(m.nfl_id)][1].loc[window, ["x", "y"]].to_numpy()
    # Only what explains the throw: the target, the defenders who shape his space (within REACH at
    # any point of the window, always at least the nearest), the most-open alternative, the QB and the ball.
    dist = {i: float(np.hypot(*(t.loc[window, ["x", "y"]].to_numpy() - tgt).T).min())
            for i, (r, t) in tracks.items() if r.side == "defense"}
    keep = {i for i, d in dist.items() if d <= REACH} | ({min(dist, key=dist.get)} if dist else set())
    primary = set(sorted(keep, key=dist.get)[:PRIMARY])
    best = int(m.best_id) if not m.threw_to_best else None
    opts = OPTIONS.loc[[(game_id, play_id)]].set_index("nfl_id").dsv_release
    out = []
    for i, (r, p) in tracks.items():
        if r.targeted:
            role = "target"
        elif i == best:
            role = "option"
        elif r.pff_role == "Pass":
            role = "passer"
        elif r.side == "ball":
            role = "ball"
        elif i in keep:
            role = "defense"
        else:
            continue
        out.append({"nfl_id": int(i), "display_name": r.display_name, "position": r.nfl_position, "team": r.team_abbr,
                    "side": r.side, "role": role, "targeted": bool(r.targeted),
                    "primary": role != "defense" or i in primary,
                    "dsv_release": float(opts[i]) if i in opts.index else None,
                    "frames": np.round(p.to_numpy(dtype=float), 2).tolist()})
    order = {"target": 0, "option": 1, "passer": 2, "defense": 3, "ball": 4}
    out.sort(key=lambda d: order[d["role"]])
    ev = fr[(fr.nfl_id == 0) & fr.event.notna()][["frame", "event"]].drop_duplicates("event")
    return {"meta": records(meta)[0], "players": out, "events": records(ev)}
