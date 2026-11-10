# AirSpace — receiver spatial dominance at the throw

When the quarterback lets it go, does the receiver's space help or hurt? Anisotropic kinematic influence fields (DSV / SICE)
on NFL Big Data Bowl regional event data (2021 weeks 1–8, all 22 players + ball).

The site is fully static: a Next.js (App Router + shadcn/ui) frontend reads pre-computed JSON from `frontend/public/data`.
The Python backend only builds that data.

## Run the site

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

## Rebuild the data (optional)

```bash
cd backend
uv venv .venv --python 3.12 && uv pip install --python .venv/bin/python -r requirements.txt
git clone --depth 1 https://github.com/ThompsonJamesBliss/nfl-big-data-bowl-regional-event-data ~/Downloads/NFL/bdb-regional
.venv/bin/python scripts/build_akit.py ~/Downloads/NFL/bdb-regional/data   # ~6 min -> backend/data/*.parquet
.venv/bin/python scripts/export_static.py                                    # ~6 min -> frontend/public/data/*.json
```

`backend/main.py` also serves the same data as a FastAPI app (`.venv/bin/uvicorn main:app --port 8000`) for exploration:
`/api/akit/summary` · `/api/akit/leaderboard` · `/api/akit/players` · `/api/akit/plays?nfl_id=&contested=` · `/api/akit/play/{game_id}/{play_id}`

## Deploy (Vercel)

Import the repo in Vercel and set **Root Directory** to `frontend`. Framework preset: Next.js. No environment variables needed.

## What's on the page

- **3D replay**: stadium generated in code (React Three Fiber). Shows the target, the most-open alternative, the QB, the ball and
  defenders within 12 yd of the target, each with its influence ellipse, plus a live 30×30 yd ownership map after the release
  (teal = receiver, orange = defense). Cameras: Broadcast, Overhead, All-22, Follow, Orbit.
- **Findings** (all 7,104 targets, 95% bootstrap CIs): catch rate by DSV at the throw, QB decision (rank of the target among his
  teammates by DSV), SICE over the first 0.5 s, AUC of DSV vs separation, receiver leaderboard (shrunk), RB/TE/WR.
- **Data caveats**: tracking ends 0.5 s after the release (no catch point); the target is parsed from the play description.
