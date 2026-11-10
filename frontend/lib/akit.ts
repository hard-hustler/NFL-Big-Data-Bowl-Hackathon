/** Per frame: [x, y, speed (yd/s), orientation, direction]; offense moves toward +x. */
export type Frame = [number, number, number, number, number]

export interface AucRow {
  metric: string
  label: string
  basis: string
  auc: number
  ci_low: number
  ci_high: number
}

export interface RateRow {
  n: number
  catch: number
  ci_low: number
  ci_high: number
  yards: number
}

export interface AkitSummary {
  n_plays: number
  n_options: number
  n_games: number
  base_catch: number
  rho_sep_dsv: number
  auc: AucRow[]
  quartiles: (RateRow & { q: number; dsv_lo: number; dsv_hi: number })[]
  sice_split: (RateRow & { group: "decay" | "flat" | "expand"; label: string })[]
  positions: { position: string; n: number; dsv_release: number; dsv_arrival: number; sice_median: number; pct_expand: number; catch: number }[]
  /** QB decision: catch rate by where the target ranked among his teammates in DSV at the throw. */
  qb: { n: number; pct_best: number; gap_median: number; ranks: (RateRow & { rank: number; label: string })[] }
}

export interface AkitLeader {
  nfl_id: number
  display_name: string
  nfl_position: string
  targets: number
  dsv: number
  dsv_shrunk: number
  sice: number
  catch: number
}

export interface AkitReceiver {
  nfl_id: number
  display_name: string
  nfl_position: string
  targets: number
  contested: number
}

export interface AkitPlayRow {
  game_id: number
  play_id: number
  nfl_id: number
  season: number
  week: number
  down: number
  yards_to_go: number
  route_ran: string | null
  pass_result: string | null
  yards_gained: number | null
  team_coverage_man_zone: string | null
  separation_at_pass_forward: number | null
  dsv_release: number
  dsv_arrival: number
  sice: number
  dsv_series: number[]
  def_dist_release: number | null
  /** Target's rank among the play's route runners by DSV at the throw (1 = most space). */
  dsv_rank: number
  n_options: number
  best_name: string
  threw_to_best: boolean
  contested: boolean
}

export interface AkitMeta extends AkitPlayRow {
  display_name: string
  nfl_position: string
  team_abbr: string
  possession_team: string
  home_team_abbr: string
  visitor_team_abbr: string
  season_type: string
  quarter: number
  game_clock: string
  los_x: number
  play_description: string
  defensive_team: string
  offense_formation: string | null
  personnel_o: string | null
  personnel_d: string | null
  team_coverage_type: string | null
  pre_snap_home_score: number | null
  pre_snap_visitor_score: number | null
  yardline_side: string | null
  yardline_number: number | null
  snap_frame: number
  release_frame: number
  arrival_frame: number
  dsv_mean: number
  def_dist_arrival: number | null
  best_id: number
  best_dsv: number
  land_x: number
  land_y: number
}

/** Game-state fields the score bug needs. */
export type GameMeta = Pick<
  AkitMeta,
  | "possession_team" | "home_team_abbr" | "visitor_team_abbr" | "pre_snap_home_score" | "pre_snap_visitor_score"
  | "quarter" | "game_clock" | "down" | "yards_to_go" | "yardline_side" | "yardline_number"
>

export interface AkitPlayer {
  nfl_id: number
  display_name: string
  position: string
  team: string
  side: "offense" | "defense" | "ball"
  role: "target" | "option" | "passer" | "defense" | "ball"
  targeted: boolean
  /** Drawn as a full figure; false for nearby defenders shown only as dots. */
  primary: boolean
  dsv_release: number | null
  frames: Frame[]
}

export interface AkitDetail {
  meta: AkitMeta
  players: AkitPlayer[]
  events: { frame: number; event: string }[]
}

/** Static JSON exported by backend/scripts/export_static.py into public/data. */
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/data/${path}`)
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json()
}

export const getAkitSummary = () => get<AkitSummary>("summary.json")
export const getAkitLeaders = () => get<{ league_dsv: number; rows: AkitLeader[] }>("leaderboard.json")
export const getAkitReceivers = () => get<AkitReceiver[]>("players.json")
export const getAkitPlays = async (nflId: number, contested: boolean) => {
  const { plays } = await get<{ total: number; plays: AkitPlayRow[] }>(`plays/${nflId}.json`)
  const shown = contested ? plays.filter((p) => p.contested) : plays
  return { total: shown.length, plays: shown }
}
export const getAkitPlay = (p: Pick<AkitPlayRow, "game_id" | "play_id">) => get<AkitDetail>(`play/${p.game_id}-${p.play_id}.json`)

/**
 * Dashboard palette (validated on the dark surface): teal = receiver / the winning side,
 * orange = defense / the losing side, blue = other offense in the 3D scene, zinc grey = comparison.
 */
export const OFFENSE_COLOR = "#3987e5"
export const DEFENSE_COLOR = "#d95926"
export const DOMINANCE_COLOR = "#10a99a"
export const NEUTRAL_COLOR = "#71717a"

/** Plain-language version of SICE (space after ÷ space at the throw): "+11%" and what it means. */
export function spaceChange(sice: number) {
  const pct = Math.round((sice - 1) * 100)
  return {
    label: `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}%`,
    text: pct > 0 ? "gained space after the throw" : pct < 0 ? "lost space after the throw" : "space held steady",
    gained: pct > 0,
  }
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** Diverging completion-rate scale: orange (low) → neutral grey at the league rate → teal (high). */
export function rateColor(v: number, base: number) {
  const lo = rgb(DEFENSE_COLOR)
  const mid = [63, 63, 70]
  const hi = rgb(DOMINANCE_COLOR)
  const t = v < base ? Math.max(0, (v - 0.2) / (base - 0.2)) : Math.min(1, (v - base) / (0.95 - base))
  const [a, b] = v < base ? [lo, mid] : [mid, hi]
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * t))
  return `rgb(${c.join(",")})`
}

/** Model parameters; must match backend/scripts/build_akit.py. */
export const AKIT = { sigma0: 1.5, k1: 0.1, k2: 0.05, dt: 0.5, tau: 0.1, cell: 0.5, half: 15 }
/** Mahalanobis radius where influence = tau (the drawn ellipse). */
export const TAU_RADIUS = Math.sqrt(-2 * Math.log(AKIT.tau))

export interface State {
  x: number
  y: number
  s: number
  o: number
  dir: number
}

const lerpDeg = (a: number, b: number, t: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * t

/** Interpolated raw state at fractional frame time t. */
export function stateAt(frames: Frame[], t: number): State {
  const n = frames.length
  const i = Math.max(0, Math.min(n - 1, Math.floor(t)))
  const j = Math.min(n - 1, i + 1)
  const k = Math.min(1, Math.max(0, t - i))
  const a = frames[i]
  const b = frames[j]
  return {
    x: a[0] + (b[0] - a[0]) * k,
    y: a[1] + (b[1] - a[1]) * k,
    s: a[2] + (b[2] - a[2]) * k,
    o: lerpDeg(a[3], b[3], k),
    dir: lerpDeg(a[4], b[4], k),
  }
}

export interface Field {
  mx: number
  my: number
  ux: number
  uy: number
  sl: number
  st: number
}

/** Influence tensor: center projected 0.5 s along velocity, long axis along body orientation. */
export function fieldOf(p: State): Field {
  const d = (p.dir * Math.PI) / 180
  const o = (p.o * Math.PI) / 180
  return {
    mx: p.x + p.s * Math.sin(d) * AKIT.dt,
    my: p.y + p.s * Math.cos(d) * AKIT.dt,
    ux: Math.sin(o),
    uy: Math.cos(o),
    sl: Math.sqrt(AKIT.sigma0 ** 2 + AKIT.k1 * p.s ** 2),
    st: Math.sqrt(AKIT.sigma0 ** 2 / (1 + AKIT.k2 * p.s ** 2)),
  }
}

export function influence(f: Field, x: number, y: number) {
  const dx = x - f.mx
  const dy = y - f.my
  const along = dx * f.ux + dy * f.uy
  const across = -dx * f.uy + dy * f.ux
  return Math.exp(-0.5 * ((along / f.sl) ** 2 + (across / f.st) ** 2))
}

export const GRID = Math.round((2 * AKIT.half) / AKIT.cell)

/**
 * Evaluate the 30x30 yd window around the arrival point. Writes per-cell ownership into `out`
 * (1 = receiver dominates, -1 = defense controls, 0 = nobody above tau) and returns DSV in yd^2.
 */
export function dominance(receiver: Field, defenders: Field[], cx: number, cy: number, out?: Int8Array) {
  let cells = 0
  for (let r = 0; r < GRID; r++) {
    // Texture row 0 sits at the field's high-y edge (see DominanceLayer).
    const y = cy + AKIT.half - (r + 0.5) * AKIT.cell
    for (let c = 0; c < GRID; c++) {
      const x = cx - AKIT.half + (c + 0.5) * AKIT.cell
      const ir = influence(receiver, x, y)
      let best = 0
      for (const d of defenders) best = Math.max(best, influence(d, x, y))
      const own = ir > best && ir > AKIT.tau ? 1 : best > AKIT.tau && best >= ir ? -1 : 0
      if (own === 1) cells++
      if (out) out[r * GRID + c] = own
    }
  }
  return cells * AKIT.cell * AKIT.cell
}
