"""AKIT at the throw: spatial dominance for every route runner when the QB releases the ball.

Source: NFL Big Data Bowl regional event data (2021 weeks 1-8, all 22 players + ball),
https://github.com/ThompsonJamesBliss/nfl-big-data-bowl-regional-event-data
Tracking ends 0.5 s after the release, so the window studied is release -> release + 0.5 s.

Each player is an anisotropic Gaussian influence field (stretched along body orientation,
centered 0.5 s ahead along the velocity vector). For every route runner we measure the
Dominated Spatial Volume (DSV, yd^2) against all 11 defenders inside a 30x30 yd window
centered on where that receiver is 0.5 s after the throw.
SICE_0.5 = DSV(release + 0.5 s) / DSV(release): did his space grow once the ball was out?

The targeted receiver is parsed from the play description ("pass short right to C.Lamb").

Writes data/akit_plays.parquet (one row per targeted play), data/akit_options.parquet
(one row per route runner per play), data/akit_frames.parquet, data/akit_roster.parquet.
"""
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

RAW = Path(sys.argv[1] if len(sys.argv) > 1 else "~/Downloads/NFL/bdb-regional/data").expanduser()
OUT = Path(__file__).resolve().parents[1] / "data"
OUT.mkdir(exist_ok=True)

# Model parameters (paper defaults) plus an influence floor so DSV is bounded.
SIGMA0, K1, K2, DT = 1.5, 0.1, 0.05, 0.5
TAU = 0.1          # a cell counts only if the receiver's influence exceeds this
CELL, HALF = 0.5, 15.0
EPS = 1.0          # yd^2 smoothing for SICE so near-zero release volumes don't explode
FLIGHT = 5         # frames after release that the tracking covers (0.5 s)
KEY = ["game_id", "play_id"]
TARGET_RX = re.compile(
    r"pass (?:incomplete )?(short|deep) (left|middle|right) (?:to|intended for) "
    r"([A-Z][a-zA-Z']*\.\s?[A-Za-z'.-]+(?: [A-Z][a-z]+)?)")

snake = {"gameId": "game_id", "playId": "play_id", "nflId": "nfl_id", "frameId": "frame_id"}
games = pd.read_csv(RAW / "games.csv").rename(columns=snake)
plays = pd.read_csv(RAW / "plays.csv").rename(columns=snake)
players = pd.read_csv(RAW / "players.csv").rename(columns=snake)[["nfl_id", "displayName", "officialPosition"]]
players.columns = ["nfl_id", "display_name", "nfl_position"]
pff = pd.read_csv(RAW / "pffScoutingData.csv").rename(columns=snake)[KEY + ["nfl_id", "pff_role", "pff_positionLinedUp"]]

plays = plays[plays.passResult.isin(["C", "I", "IN"])]
plays = plays.merge(games[["game_id", "season", "week", "homeTeamAbbr", "visitorTeamAbbr"]], on="game_id")
parsed = plays.playDescription.str.extract(TARGET_RX)
plays["depth"], plays["lane"], plays["target_name"] = parsed[0], parsed[1], parsed[2].str.rstrip(".")
plays = plays.dropna(subset=["target_name"])


def alnum(s: str) -> str:
    return re.sub(r"[^a-z]", "", s.lower())


# Match "C.Godwin" to a route runner on that play: same first initial, display name ends with the surname.
routes = pff[pff.pff_role == "Pass Route"].merge(players, on="nfl_id")
cand = routes.merge(plays[KEY + ["target_name"]], on=KEY)
ini, sur = cand.target_name.str.split(".", n=1).str[0], cand.target_name.str.split(".", n=1).str[1]
cand = cand[[d.startswith(i) and alnum(d).endswith(alnum(s)) for d, i, s in zip(cand.display_name, ini, sur)]]
target = cand.drop_duplicates(KEY, keep=False)[KEY + ["nfl_id"]]
plays = plays.merge(target, on=KEY)
play_set = set(map(tuple, plays[KEY].to_numpy()))
print("plays with a matched target:", len(plays), flush=True)

frames = []
for f in sorted((RAW / "tracking").glob("tracking_*.csv")):
    t = pd.read_csv(f, usecols=["gameId", "playId", "nflId", "frameId", "team", "playDirection", "x", "y", "s", "o", "dir", "event"])
    t = t.rename(columns=snake)
    frames.append(t[[k in play_set for k in zip(t.game_id, t.play_id)]])
fr = pd.concat(frames, ignore_index=True)

# Normalize so the offense moves toward +x.
left = fr.playDirection == "left"
fr.loc[left, "x"] = 120 - fr.loc[left, "x"]
fr.loc[left, "y"] = 160 / 3 - fr.loc[left, "y"]
for c in ("o", "dir"):
    fr.loc[left, c] = (fr.loc[left, c] + 180) % 360
fr["frame"] = fr.frame_id - 1
fr["event"] = fr.event.where(fr.event != "None").replace(
    {"autoevent_passforward": "pass_forward", "autoevent_ballsnap": "ball_snap"})
fr["nfl_id"] = fr.nfl_id.fillna(0).astype(int)  # 0 = football
fr[["o", "dir"]] = fr[["o", "dir"]].fillna(0)
for c in ("x", "y", "s", "o", "dir"):
    fr[c] = fr[c].astype("float32").round(2)

ball = fr[fr.nfl_id == 0]
ev = ball[ball.event.notna()]
snap = ev[ev.event == "ball_snap"].groupby(KEY).frame.min().rename("snap_frame")
rel = ev[ev.event == "pass_forward"].groupby(KEY).frame.min().rename("release_frame")
last = fr.groupby(KEY).frame.max().rename("last_frame")
plays = plays.merge(snap, left_on=KEY, right_index=True).merge(rel, left_on=KEY, right_index=True).merge(last, left_on=KEY, right_index=True)
plays["end_frame"] = np.minimum(plays.release_frame + FLIGHT, plays.last_frame)
plays = plays[plays.end_frame - plays.release_frame >= 3]
fr = fr.merge(plays[KEY + ["possessionTeam"]], on=KEY)
fr["side"] = np.select([fr.nfl_id == 0, fr.team == fr.possessionTeam], ["ball", "offense"], "defense")
print("plays with snap + release:", len(plays), flush=True)


def influence(gx, gy, x, y, s, dir_deg, o_deg):
    """Anisotropic Gaussian influence on the grid. NGS angles: degrees clockwise from +y."""
    d, o = np.radians(dir_deg), np.radians(o_deg)
    mx, my = x + s * np.sin(d) * DT, y + s * np.cos(d) * DT
    sl2 = SIGMA0 ** 2 + K1 * s ** 2
    st2 = SIGMA0 ** 2 / (1 + K2 * s ** 2)
    ux, uy = np.sin(o), np.cos(o)            # long axis along body orientation
    dx, dy = gx - mx, gy - my
    along = dx * ux + dy * uy
    across = -dx * uy + dy * ux
    return np.exp(-0.5 * (along ** 2 / sl2 + across ** 2 / st2))


off = np.arange(-HALF, HALF, CELL) + CELL / 2
route_ids = routes.groupby(KEY).nfl_id.apply(set)
by_play = {k: g.set_index("frame") for k, g in fr.groupby(KEY)}
opts = []
for r in plays.itertuples(index=False):
    k = (r.game_id, r.play_id)
    g = by_play[k]
    win = g[(g.index >= r.release_frame) & (g.index <= r.end_frame)]
    dfs = win[win.side == "defense"]
    for rid in route_ids.get(k, ()):
        me = win[win.nfl_id == rid]
        if len(me) < 3:
            continue
        cx, cy = me.iloc[-1].x, me.iloc[-1].y
        gx, gy = np.meshgrid(cx + off, cy + off)
        series = []
        for f, q in me.iterrows():
            ir = influence(gx, gy, q.x, q.y, q.s, q.dir, q.o)
            best = np.zeros_like(ir)
            for dj in dfs.loc[[f]].itertuples(index=False):
                best = np.maximum(best, influence(gx, gy, dj.x, dj.y, dj.s, dj.dir, dj.o))
            series.append(float(((ir > best) & (ir > TAU)).sum() * CELL * CELL))
        q0 = me.iloc[0]
        d0 = dfs.loc[[r.release_frame]] if r.release_frame in dfs.index else dfs.iloc[:0]
        q1 = me.iloc[-1]
        d1 = dfs.loc[[r.end_frame]] if r.end_frame in dfs.index else dfs.iloc[:0]
        opts.append({"game_id": r.game_id, "play_id": r.play_id, "nfl_id": rid, "targeted": rid == r.nfl_id,
                     "dsv_series": [round(v, 2) for v in series], "dsv_release": series[0], "dsv_arrival": series[-1],
                     "dsv_mean": float(np.mean(series)), "sice": (series[-1] + EPS) / (series[0] + EPS),
                     "def_dist_release": float(np.hypot(d0.x - q0.x, d0.y - q0.y).min()) if len(d0) else np.nan,
                     "def_dist_arrival": float(np.hypot(d1.x - q1.x, d1.y - q1.y).min()) if len(d1) else np.nan,
                     "land_x": float(cx), "land_y": float(cy)})
opt = pd.DataFrame(opts).merge(players, on="nfl_id", how="left")
# QB decision: where did the target rank among his teammates by DSV at release?
opt["dsv_rank"] = opt.groupby(KEY).dsv_release.rank(ascending=False, method="min").astype(int)
opt["n_options"] = opt.groupby(KEY).nfl_id.transform("size")
best = opt.sort_values("dsv_release", ascending=False).drop_duplicates(KEY)[KEY + ["nfl_id", "display_name", "dsv_release"]]
best.columns = KEY + ["best_id", "best_name", "best_dsv"]
tg = opt[opt.targeted].drop(columns=["targeted", "display_name", "nfl_position"])
p = plays.merge(tg, on=KEY + ["nfl_id"]).merge(best, on=KEY).merge(players, on="nfl_id")
p = p[p.nfl_position.isin(["WR", "TE", "RB", "FB"])]
p["nfl_position"] = p.nfl_position.replace({"FB": "RB"})
p["threw_to_best"] = p.dsv_rank == 1

own = p.yardlineSide == p.possessionTeam
p["los_x"] = np.where(p.yardlineNumber == 50, 60, np.where(own, 10 + p.yardlineNumber, 110 - p.yardlineNumber))
p["route_ran"] = p.depth.str.capitalize() + " " + p.lane
p["contested"] = p.def_dist_release <= 2.0
p["separation_at_pass_forward"] = p.def_dist_release
p["arrival_frame"] = p.end_frame
p = p.rename(columns={
    "possessionTeam": "possession_team", "defensiveTeam": "defensive_team", "homeTeamAbbr": "home_team_abbr",
    "visitorTeamAbbr": "visitor_team_abbr", "playDescription": "play_description", "gameClock": "game_clock",
    "yardsToGo": "yards_to_go", "yardlineSide": "yardline_side", "yardlineNumber": "yardline_number",
    "preSnapHomeScore": "pre_snap_home_score", "preSnapVisitorScore": "pre_snap_visitor_score",
    "passResult": "pass_result", "prePenaltyPlayResult": "yards_gained", "offenseFormation": "offense_formation",
    "pff_passCoverage": "team_coverage_type", "pff_passCoverageType": "team_coverage_man_zone",
    "personnelO": "personnel_o", "personnelD": "personnel_d"})
p["team_abbr"] = p.possession_team
p["season_type"] = "REG"
cols = ["game_id", "play_id", "nfl_id", "display_name", "nfl_position", "team_abbr", "possession_team", "defensive_team",
        "home_team_abbr", "visitor_team_abbr", "season", "season_type", "week", "quarter", "game_clock",
        "down", "yards_to_go", "los_x", "play_description", "offense_formation", "personnel_o", "personnel_d",
        "team_coverage_man_zone", "team_coverage_type", "route_ran", "pass_result", "yards_gained",
        "separation_at_pass_forward", "pre_snap_home_score", "pre_snap_visitor_score", "yardline_side",
        "yardline_number", "snap_frame", "release_frame", "arrival_frame", "dsv_series", "dsv_release",
        "dsv_arrival", "dsv_mean", "sice", "def_dist_release", "def_dist_arrival", "land_x", "land_y",
        "dsv_rank", "n_options", "best_id", "best_name", "best_dsv", "threw_to_best", "contested"]
p = p[cols]

keep = set(map(tuple, p[KEY].to_numpy()))
fr = fr[[k in keep for k in zip(fr.game_id, fr.play_id)]]
opt = opt[[k in keep for k in zip(opt.game_id, opt.play_id)]]
roster = fr[KEY + ["nfl_id", "team", "side"]].drop_duplicates(KEY + ["nfl_id"]).merge(players, on="nfl_id", how="left")
roster = roster.merge(pff[KEY + ["nfl_id", "pff_role"]], on=KEY + ["nfl_id"], how="left")
roster["display_name"] = roster.display_name.fillna("Football")
roster["nfl_position"] = roster.nfl_position.fillna("BALL")
roster = roster.merge(p[KEY + ["nfl_id"]].assign(targeted=True), on=KEY + ["nfl_id"], how="left")
roster["targeted"] = roster.targeted.fillna(False).astype(bool)
roster = roster.rename(columns={"team": "team_abbr"})
fr = fr[KEY + ["nfl_id", "frame", "x", "y", "s", "o", "dir", "event"]]

p.to_parquet(OUT / "akit_plays.parquet", index=False)
opt.to_parquet(OUT / "akit_options.parquet", index=False)
fr.to_parquet(OUT / "akit_frames.parquet", index=False)
roster.to_parquet(OUT / "akit_roster.parquet", index=False)
print("plays", len(p), "options", len(opt), "frames", len(fr))
print(p.groupby("nfl_position")[["dsv_release", "dsv_arrival", "sice"]].agg(["mean", "size"]).round(2))
print("threw to most-open receiver:", round(p.threw_to_best.mean(), 3))
print("catch rate by threw_to_best:", p.groupby("threw_to_best").pass_result.apply(lambda s: (s == "C").mean()).round(3).to_dict())
