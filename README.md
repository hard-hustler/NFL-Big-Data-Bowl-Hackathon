# AirSpace

### Two receivers, the same two yards from the nearest defender. Are they equally open?

**No. And the reason is motion, which a distance cannot see.**

AirSpace measures how much space a receiver owns at the moment the quarterback lets go of the ball, for every WR, TE and RB target in 122 NFL games (2021 weeks 1 to 8, 7,104 targets, 32,901 receiver options). It turns every player into a moving, direction-aware influence field, then asks what that field says about the catch that distance alone does not.

> **The question.** NFL tracking data usually reduces "open" to one number: the distance between two dots. Does a receiver whose defender is falling behind have the same space as one whose defender is closing on him, at exactly the same distance?

## The answer in three lines

1. **Equal distance is not equal space.** At 0 to 2 yards of separation, targets are caught **65%** of the time when the nearest defender is falling behind and **31%** when he is closing fast. The gap shrinks as separation grows but never closes.
2. **Motion adds information that distance lacks.** Adding the closing speed of the nearest defender to separation raises catch-prediction AUC by **+0.016** (95% interval +0.011 to +0.022), after controlling for route depth, lane, position and coverage type.
3. **Quarterbacks leave catches on the table.** Only **30%** of throws go to the receiver with the most space. Those are caught **76%** of the time. Throws to the third most open receiver are caught **58%** of the time.

![Same separation, different catch point](https://raw.githubusercontent.com/hard-hustler/NFL-Pre-Work/main/figures/lean/1_hook.png)

*Hopkins and Toney, two real short-left plays with about 2 yd of separation at the throw. This figure comes from the catch-point control analysis ([NFL-Pre-Work](https://github.com/hard-hustler/NFL-Pre-Work), shown interactively in the site's deep-dive section), which uses a related influence-field metric (Catch-Point Control, CPC) and measures separation to coverage defenders only, so its separation values (1.9 and 2.0 yd) differ slightly from the AirSpace values in the table below. Blue = offense controls the space, red = defense. Star = target, dashed circle = projected catch zone.*

| Play (AirSpace metrics) | Separation | Nearest defender | Space at throw (DSV) | Space 0.5 s later | Result |
|---|---|---|---|---|---|
| DeAndre Hopkins, ARI vs TEN, week 1, short left, Cover-3 | 1.7 yd | gap **widening** at 1.3 yd/s | 25.8 yd² (3rd of 5 options) | 29.8 yd² | Complete |
| Kadarius Toney, NYG vs ATL, week 3, short left, Cover-2 | 2.1 yd | gap **closing** at 0.9 yd/s | 15.0 yd² (5th of 5 options) | 7.8 yd² | Incomplete |

Hopkins and Toney sit at nearly the same distance from the nearest defender. One of them is pulling away from his man and the other is being squeezed.

---

## What we found

All numbers come from the data in `frontend/public/data` (the same files the site loads), and every one can be reproduced by the snippet in [Reproduce the headline result](#reproduce-the-headline-result).

### 1. The same distance hides a swing of up to 34 points in catch rate

Closing speed is the rate at which the gap between the target and the nearest defender shrinks at the throw, from their velocity vectors. Positive means the defender is catching up; negative means he is falling behind. In the table, "falling behind" means closing speed at or below -1 yd/s, and "closing fast" means at or above +1.5 yd/s (about 3 mph).

| Separation at throw | Catch rate, defender falling behind | Catch rate, defender closing fast | Difference | Plays (behind / closing) |
|---|---|---|---|---|
| 0 to 2 yd | 65% | 31% | **-34 pts** | 329 / 218 |
| 2 to 3 yd | 69% | 45% | **-24 pts** | 409 / 278 |
| 3 to 4 yd | 78% | 63% | **-15 pts** | 415 / 319 |
| 4 to 6 yd | 79% | 71% | **-8 pts** | 724 / 513 |
| 6+ yd | 86% | 73% | **-13 pts** | 602 / 312 |

The 95% bootstrap interval for the difference excludes zero in every band (for example, 0 to 2 yd: -34 points, interval -43 to -26). The effect also holds inside subgroups: short routes (0 to 2 yd: 70% vs 36%), deep routes (53% vs 15%, small samples), man coverage (68% vs 32%) and zone coverage (64% vs 31%).

This is an association, not proof of cause. Defenders who are closing are usually the ones with a better read of the route.

### 2. Equal distance, unequal leverage

![At 1.5 to 3 yd of separation, catch rate by who is closer to the landing spot](https://raw.githubusercontent.com/hard-hustler/NFL-Pre-Work/main/figures/lean/3_leverage.png)

*Catch-point control analysis. At 1.5 to 3 yd of separation, the catch rate is 38% when the defender is closer to the projected landing spot, 50% when even and 67% when the receiver is closer. "Closer to the spot" is the geometric version of the same idea as closing speed.*

### 3. The same separation, split by who owns the catch point

![At the same separation, control splits the outcome](https://raw.githubusercontent.com/hard-hustler/NFL-Pre-Work/main/figures/lean/2_same_separation_split_by_control.png)

*Catch-point control analysis. Plays are grouped by separation, then split into thirds by catch-point control. At 1 to 2 yd, the catch rate is 34% in the lowest third and 67% in the highest third. The gap holds at every separation band.*

AirSpace's own influence metric, DSV, shows the same ordering across all 7,104 targets:

| DSV at throw (quartile) | DSV range | Targets | Catch rate | 95% interval | Yards per target |
|---|---|---|---|---|---|
| Q1 | 8.8 to 23.0 yd² | 1,776 | 48% | 46 to 51% | 5.3 |
| Q2 | 23.0 to 26.3 yd² | 1,776 | 57% | 55 to 59% | 7.4 |
| Q3 | 26.3 to 30.0 yd² | 1,776 | 68% | 66 to 70% | 8.7 |
| Q4 | 30.0 to 33.3 yd² | 1,776 | **82%** | 80 to 83% | 9.4 |

The gradient holds inside each position (WR: 46% to 77%, TE: 51% to 83%, RB: 60% to 88%), so it is not just the fact that running backs are open more often.

**Where DSV helps and where it does not.** Within a fixed separation band, receivers in the top third of DSV are caught more often than those in the bottom third, but only when there is room to work:

| Separation | Bottom third of DSV | Top third of DSV | Difference (95% interval) |
|---|---|---|---|
| 0 to 2 yd | 39% | 42% | +2.8 pts (-2.4 to +8.3) |
| 2 to 3 yd | 57% | 61% | +3.8 pts (-2.5 to +11.1) |
| 3 to 4 yd | 67% | 76% | **+8.8 pts (+2.1 to +15.5)** |
| 4 to 6 yd | 71% | 81% | **+9.6 pts (+5.0 to +14.5)** |
| 6+ yd | 76% | 86% | **+9.5 pts (+4.1 to +14.7)** |

Under 3 yards, the interval includes zero. In tight coverage the nearest defender dominates the picture and DSV adds nothing we can detect.

### 4. The catch point is won before the throw

![Catch-point control in the last second before release](https://raw.githubusercontent.com/hard-hustler/NFL-Pre-Work/main/figures/lean/4_timing.png)

*Catch-point control analysis. Mean control at the projected catch point over the last second before release. On completions it climbs from 0.50 to 0.75. On incompletions it stalls at 0.62.*

AirSpace measures the window from the throw to 0.5 s after it, which is all the tracking provides. Over that window, **space gained after the ball is out does not help**. Targets whose space shrank (SICE below 1, n = 4,308) were caught 65% of the time. Targets whose space grew (SICE above 1, n = 2,518) were caught 61% of the time. SICE alone has an AUC of 0.478, slightly below a coin flip. The timing result therefore points the same way from both analyses: what matters is the position reached at the throw.

### 5. Quarterbacks and the open receiver

Each target is ranked among every route runner on the play by DSV at the throw (an average of 4.6 options per play).

| Target's space rank | Throws | Catch rate | 95% interval | Yards per target |
|---|---|---|---|---|
| Most space | 2,135 | **76%** | 74 to 78% | 9.0 |
| 2nd most | 1,835 | 64% | 62 to 66% | 8.1 |
| 3rd most | 1,427 | 58% | 55 to 60% | 7.2 |
| 4th or lower | 1,705 | 53% | 51 to 55% | 6.2 |

- Quarterbacks threw to the most-open receiver on **30%** of plays. A random pick among the options would hit him 22% of the time.
- When the quarterback passed him up, the open man had a median of **4.5 yd²** more space than the one who got the ball.
- The gradient holds inside route types: short routes 80%, 72%, 65%, 59% by rank; deep routes 54%, 41%, 38%, 32%.
- Running backs are the most-open option half the time (50%), tight ends and wide receivers about a quarter of the time (26%).

The caveat is that reads, progressions and pressure are not modeled. A quarterback may rightly pass on the open checkdown.

### 6. Does speed buy space? Not through the area of the bubble

The influence model stretches a fast player's field along his direction of travel and narrows it across. The area of the field barely changes with speed (32.6 yd² at rest, 31.1 yd² at 9 yd/s, from the model's own equations). As a result, DSV is capped near 33 yd², and 26% of targets have a DSV of 30 yd² or more.

The data shows the same thing. Mean DSV at the throw is flat across receiver speed:

| Receiver speed at the throw | Targets | Mean DSV | Catch rate | On a deep route | Nearest defender's speed |
|---|---|---|---|---|---|
| Under 6 mph | 800 | 26.0 yd² | 73% | 3% | 5.6 mph |
| 6 to 10 mph | 1,462 | 26.2 yd² | 70% | 4% | 6.5 mph |
| 10 to 14 mph | 2,746 | 26.0 yd² | 65% | 13% | 8.7 mph |
| 14+ mph | 2,096 | 25.9 yd² | 54% | 53% | 12.1 mph |

Speed changes where a receiver's space lies, not how much of it there is. The fastest receivers are on deep routes (53% of them, against 22% of all targets) with defenders running at close to the same speed, which is why they are caught less often. So the signal sits in **relative** motion, the gap between the two players' velocities (finding 1), and not in either player's speed alone. The site's "Ideas we tested" panel shows the same confound in the control analysis: receivers at 14+ mph have 0.081 less control than their separation predicts, and their median throw travels 15.7 air yards against 5.4 for receivers under 6 mph. Defender hip angle shows no such pattern worth a model term.

### 7. Where the three position groups differ

| Position | Targets | DSV at throw | DSV +0.5 s | Median SICE | Space grew | Catch rate |
|---|---|---|---|---|---|---|
| RB | 1,270 | 28.2 yd² | 26.8 yd² | 0.98 | 32% | **76%** |
| TE | 1,544 | 25.7 yd² | 24.2 yd² | 0.97 | 37% | 67% |
| WR | 4,290 | 25.5 yd² | 24.1 yd² | 0.97 | 36% | 59% |

Man coverage (2,031 targets) holds receivers to 24.1 yd² on average at 2.5 yd of separation and a 55% catch rate. Zone coverage (4,716 targets) concedes 27.0 yd² at 4.3 yd of separation and a 68% catch rate.

---

## Does it predict?

Five-fold cross-validation with folds split by game, logistic regression, 300 game-level bootstrap resamples for intervals, 7,098 targets. Context is route depth (deep or short), lane (left, middle, right), position and coverage type (man or zone).

| Model | AUC | Change vs baseline (95% interval) |
|---|---|---|
| Separation alone | 0.699 | baseline |
| Separation + context | 0.723 | baseline for rows below |
| Separation + closing speed | 0.716 | +0.017 vs separation alone (+0.012 to +0.023) |
| **Separation + closing speed + context** | **0.739** | **+0.016 vs separation + context (+0.011 to +0.022)** |
| Separation + DSV | 0.702 | +0.003 vs separation alone (+0.001 to +0.005) |
| Separation + closing speed + DSV + context | 0.739 | +0.001 vs the row above without DSV (-0.001 to +0.002) |

Two honest results fall out of this table:

- **Motion of the nearest defender is the useful addition.** The orientation of the nearest defender (whether he faces the receiver) adds nothing on top of closing speed.
- **DSV alone does not beat separation.** On all 7,104 targets, nearest-defender separation scores AUC 0.702 and DSV scores 0.662 (the same ordering as the `summary.json` shipped with the site). The two measures are strongly related (Spearman ρ = 0.73). DSV earns its place as a visual and explanatory tool, and as a way to rank all route runners on a play (finding 5), more than as a stronger predictor.

---

## How it works

### Data

- **Tracking and events:** NFL Next Gen Stats via the [Big Data Bowl regional event data](https://github.com/ThompsonJamesBliss/nfl-big-data-bowl-regional-event-data), 2021 weeks 1 to 8, all 22 players and the ball at 10 Hz.
- **Roles:** Pro Football Focus scouting data, used to tell route runners from blockers and rushers.
- **Plays:** dropbacks with a pass result of complete, incomplete or interception (sacks and scrambles are excluded). A play is kept only if tracking covers at least 3 frames after the throw. The result is 7,104 targets in 122 games, with a 63.7% catch rate. An interception counts as not caught.
- **Targeted receiver:** the tracking data has no target column, so the target is parsed from the play description (for example, "pass short right to C.Lamb") and matched to a PFF route runner by first initial and surname. Ambiguous matches are dropped.
- **Orientation:** every play is flipped so the offense moves toward +x.

### The influence field

Each player is an anisotropic Gaussian, a smooth ellipse of influence that follows how the player is moving:

- Its center sits 0.5 s ahead along the velocity vector.
- Its long axis follows the player's **body orientation**, not just his direction of travel.
- Its spread grows with speed along the long axis and shrinks across it:
  σ²_long = σ₀² + 0.1·s² and σ²_lat = σ₀² / (1 + 0.05·s²), with σ₀ = 1.5 yd and s in yd/s.
- A 0.5 yd cell belongs to the receiver if his influence beats **all 11 defenders** and exceeds τ = 0.1.

### The two metrics

- **DSV (Dominated Spatial Volume):** the area, in yd², that the receiver owns in a 30 × 30 yd window centered on where he will be 0.5 s after the throw. It is computed for every route runner on the play, not just the target.
- **SICE:** DSV at +0.5 s divided by DSV at the throw, each plus 1 yd² so that near-zero starting values do not explode (the code names it `SICE_0.5` and does not spell out the acronym). SICE above 1 means the receiver's space grew after the ball left the quarterback's hand.
- **Separation:** the distance to the nearest of the 11 defenders at the throw. "Tight coverage" is a separation of 2 yd or less (29% of targets, caught 41% of the time against 73% for the rest).

The two metrics are built to answer the question as asked: velocity and orientation enter the field, and the field is evaluated against the whole defense. The parameters follow the standard form used in sports-tracking influence models; the repo labels them "paper defaults" and does not name a single source, so we do not attribute them to one.

### Methods that make the results trustworthy

- Folds are split by game, so a game's plays never sit in both training and test data.
- Intervals are bootstrapped over games for model comparisons and over plays for rates.
- The leaderboard shrinks each receiver's mean DSV toward the league mean (26.0 yd²) with 15 pseudo-targets and requires at least 15 targets.
- Every model comparison reports the baseline it is measured against, including the ones where the new variable does not help.

---

## Limits you should know about

1. **Tracking stops 0.5 s after the throw.** The catch itself is not observed, so we study the space at release and in the first half-second of flight, not at the catch point.
2. **Association, not cause.** Closing speed and DSV describe the situation at the throw. Route design, quarterback timing and coverage calls all feed them.
3. **DSV saturates.** Because area barely changes with speed, a large share of targets sit near 33 yd². The metric separates crowded receivers from open ones well, and open receivers from very open ones poorly. That is also why SICE cannot rise for receivers who start with maximum space.
4. **Leaderboard reliability is moderate.** Split in half at random, receivers' mean DSV correlates at r = 0.50 across halves (0.67 after the Spearman-Brown adjustment) for receivers with 20+ targets. Separation does better (0.66, or 0.80 adjusted). The leaderboard is dominated by running backs (17 of the top 20), so compare receivers within a position.
5. **The browser recomputes DSV from rounded data.** The site recomputes DSV live from shipped frames (coordinates to 0.1 yd, angles to whole degrees, defenders within 12 yd). It matches the stored value to a median of 2.5 yd² (95th percentile about 10 yd²), so the live readout can differ slightly from the number in the inspector.
6. **Eight weeks, one season.** All intervals describe sampling noise within these 122 games.
7. **Target matching.** Parsed from play text, so targets are missing where the text is ambiguous.

---

## The site

AirSpace is a static Next.js site that replays any target in 3D and shows the numbers behind it. Every chart animates in, supports hover tooltips that dim the other marks, and carries a one-sentence "how to read this" hint in plain language. Catch rates share one color scale: teal above the league rate (63.7%), grey near it, orange below.

- **Film room:** search any of 416 receivers (with a position filter), switch to tight coverage only (defender within 2 yd), and step through his targets as a filmstrip. Each card shows the DSV curve through the flight, the SICE value and where he ranked in space.
- **3D replay** (React Three Fiber): a stadium generated in code, with team-colored end zones and a broadcast score bug. It shows three players (the quarterback, the target and the nearest defender) and the ball. The target and the nearest defender carry influence ellipses. A live 30 × 30 yd map shades, in teal, the cells the receiver owns after the throw, computed against every defender within 12 yd. Five cameras: Broadcast, Overhead (space map), All-22, Follow, Orbit. Playback at 0.25×, 0.5×, 1× and 2×. Ball height is illustrative, because tracking is two-dimensional.
- **Lower third and inspector:** live DSV, SICE and nearest defender, plus coverage, down and distance, and the play-by-play text.
- **Findings panels:** catch rate by DSV quartile, quarterback decisions, space after the throw, DSV against separation, a shrunk leaderboard and a position table, all with 95% intervals.
- **Catch-point control (deep dive):** five interactive panels built from the NFL-Pre-Work analysis of 6,790 targets with a usable projected catch point (base catch rate 65.8%). *Same separation, different outcome* is a heat map plus lines of catch rate by separation and control third. *Control is not just distance* plots every target against separation and control, over binned catch rates. *Leverage* is a grid of catch rate by separation and who is closer to the landing spot. *Timing* shows control, separation and owned area from 1 s before the throw to 0.4 s after, for caught and uncaught passes. *Ideas we tested* shows control relative to separation by receiver speed and by defender hip angle. Proportions carry Wilson 95% intervals and means carry normal-approximation intervals.

### Architecture

```
NFL tracking CSVs (2021 wk 1-8) ──► backend/scripts/build_akit.py ──► backend/data/*.parquet
                                                                          │
                          backend/akit.py (FastAPI router + summary) ◄────┤
                                          │                               │
                          backend/scripts/export_static.py ◄──────────────┘
                                          │
                          frontend/public/data/*.json  (7,104 play files + summaries)
                                          │
NFL-Pre-Work data/derived/*.csv ──► backend/scripts/export_prework_charts.py ──► frontend/public/data/control.json
                                          │
                  Next.js 16 · React 19 · React Three Fiber · Tailwind 4 · shadcn/ui
```

| Path | What it does |
|---|---|
| `backend/scripts/build_akit.py` | Parses targets, normalizes direction, computes DSV and SICE for every route runner, writes four parquet files |
| `backend/akit.py` | FastAPI router: summary statistics, leaderboard, per-receiver plays, per-play replay payload |
| `backend/main.py` | App entry point with CORS and a health check |
| `backend/scripts/export_static.py` | Exports every API response to static JSON for the site |
| `backend/scripts/export_prework_charts.py` | Aggregates the NFL-Pre-Work catch-point control tables into `control.json`, with Wilson and normal intervals |
| `frontend/lib/akit.ts` | Types, the influence field and the DSV function (the same math as the backend) |
| `frontend/lib/control.ts` | Types and loader for `control.json` |
| `frontend/components/akit/` | Page layout, findings panels, control charts, shared chart kit (reveal animation, tooltips), searchable receiver picker, filmstrip, lower third, broadcast HUD |
| `frontend/components/replay/` | The 3D scene: stadium, field texture, player figures, labels, ownership map |
| `frontend/public/data/` | Pre-computed JSON the site reads (about 83 MB) |

The API (`uvicorn main:app`) serves the same data for exploration: `/api/akit/summary`, `/leaderboard`, `/players`, `/plays?nfl_id=&contested=` and `/play/{game_id}/{play_id}`.

---

## Reproduce

### Run the site

Needs Node.js 20.9 or newer (a Next.js 16 requirement).

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

To deploy on Vercel, import the repo, set **Root Directory** to `frontend`, and leave the framework on Next.js. No environment variables are needed.

### Rebuild the data (optional, about 12 minutes)

```bash
cd backend
uv venv .venv --python 3.12 && uv pip install --python .venv/bin/python -r requirements.txt
git clone --depth 1 https://github.com/ThompsonJamesBliss/nfl-big-data-bowl-regional-event-data ~/Downloads/NFL/bdb-regional
.venv/bin/python scripts/build_akit.py ~/Downloads/NFL/bdb-regional/data   # about 6 min -> backend/data/*.parquet
.venv/bin/python scripts/export_static.py                                    # about 6 min -> frontend/public/data/*.json

# catch-point control charts from the NFL-Pre-Work repo (a few seconds)
git clone --depth 1 https://github.com/hard-hustler/NFL-Pre-Work ~/Downloads/NFL/NFL-Pre-Work
.venv/bin/python scripts/export_prework_charts.py ~/Downloads/NFL/NFL-Pre-Work/data/derived   # -> frontend/public/data/control.json
```

### Reproduce the headline result

This reads only the shipped JSON, needs `numpy` and `pandas`, and runs from the repository root in under a minute. It prints the catch rate at the same separation, split by whether the nearest defender is falling behind or closing.

```python
import glob, json
import numpy as np, pandas as pd

D = "frontend/public/data/"
vec = lambda s, deg: s * np.array([np.sin(np.radians(deg)), np.cos(np.radians(deg))])

rows = []
for f in glob.glob(D + "play/*.json"):
    p = json.load(open(f)); m = p["meta"]; r = m["release_frame"]
    tgt = next(q for q in p["players"] if q["role"] == "target")["frames"][r]   # [x, y, speed, orientation, direction]
    near = min((q["frames"][r] for q in p["players"] if q["side"] == "defense"),
               key=lambda a: np.hypot(a[0] - tgt[0], a[1] - tgt[1]))
    gap = np.hypot(tgt[0] - near[0], tgt[1] - near[1])
    if gap < 0.3:
        continue
    u = (np.array(tgt[:2]) - np.array(near[:2])) / gap                           # defender -> receiver
    closing = -float((vec(tgt[2], tgt[4]) - vec(near[2], near[4])) @ u)          # + : gap shrinking (yd/s)
    rows.append((gap, closing, m["pass_result"] == "C"))

d = pd.DataFrame(rows, columns=["separation", "closing", "caught"])
d["band"] = pd.cut(d.separation, [0, 2, 3, 4, 6, 60], labels=["0-2", "2-3", "3-4", "4-6", "6+"])
behind, closing = d[d.closing <= -1], d[d.closing >= 1.5]
print(pd.DataFrame({"defender behind": behind.groupby("band", observed=True).caught.mean(),
                    "defender closing": closing.groupby("band", observed=True).caught.mean(),
                    "n behind": behind.groupby("band", observed=True).size(),
                    "n closing": closing.groupby("band", observed=True).size()}).round(2))
```

Expected output:

```
      defender behind  defender closing  n behind  n closing
band
0-2              0.65              0.31       329        218
2-3              0.69              0.45       409        278
3-4              0.78              0.63       415        319
4-6              0.79              0.71       724        513
6+               0.86              0.73       602        312
```

### The NFL-Pre-Work analysis

The figures labeled *Catch-point control analysis* come from [hard-hustler/NFL-Pre-Work](https://github.com/hard-hustler/NFL-Pre-Work), a separate Python analysis of the same dataset built with Kiro. It measures a related influence-field metric (Catch-Point Control) at a projected catch point, with its own validation, and feeds the site's deep-dive section through `export_prework_charts.py`. It corroborates the direction of the AirSpace findings. Its numbers are not interchangeable with the ones above, because the separation definition, target set (6,790 against 7,104) and metric differ.

---

## How this maps to the judging dimensions

NYU's event page lists four scoring dimensions: Football Insight, Technical Execution, Communication and Originality. The full rubric is shared at check-in, so this mapping uses those four names only.

| Dimension | Where to look |
|---|---|
| **Football Insight** | Equal distance hides a swing of up to 34 points in catch rate (finding 1). Leverage and the geometry of the landing spot (finding 2). Quarterbacks throw to the most-open receiver 30% of the time, and the catch-rate cost of passing on him is 12 points (finding 5). Man and zone coverage take space differently (finding 7). |
| **Technical Execution** | A physically motivated influence field with an explicit window, threshold and parameters. Folds split by game, game-level bootstrap intervals, shrinkage for the leaderboard, a reliability check, and a one-file reproduction of the headline result. Negative results are reported: DSV alone does not beat separation, and SICE does not predict catches. |
| **Communication** | One question, answered in three lines before any method. Every claim has a table or figure and a stated limit. A 3D film room that shows the same numbers on real plays, and a plain-language hint on every chart. |
| **Originality** | A direction-aware field evaluated against all 11 defenders for every route runner, which makes the quarterback-decision analysis possible. The finding that speed reshapes a player's field without changing its area, so relative motion carries the signal. A live, in-browser recomputation of the space map on every frame. |

---

## References

- Fernández, J. and Bornn, L. (2018). *Wide Open Spaces: A statistical technique for measuring space creation in professional soccer.* MIT Sloan Sports Analytics Conference.
- Spearman, W. (2018). *Beyond Expected Goals.* MIT Sloan Sports Analytics Conference.
- Fujimura, A. and Sugihara, K. (2005). Geometric analysis and quantitative evaluation of sport teamwork. *Systems and Computers in Japan*, 36(6), 49 to 58.
- Narizuka, T., Yamazaki, Y. and Takizawa, K. (2020). *Fundamental framework for the space evaluation in football games.* arXiv:2001.11629.
- *Football player dominant region determined by a novel model based on instantaneous kinematics variables.* Scientific Reports 11, 18209 (2021).
- NYU. *NFL Big Data Bowl, NYU Edition.* https://www.nyu.edu/life/information-technology/artificial-intelligence-at-nyu/learn-explore/events/big-data-bowl-2026.html

## Data and credit

Tracking data: NFL Next Gen Stats, provided through the NFL Big Data Bowl. Scouting data: Pro Football Focus. Regional event data repository: ThompsonJamesBliss/nfl-big-data-bowl-regional-event-data.
