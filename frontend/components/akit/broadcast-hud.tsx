"use client"

import { Gauge, Pause, Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import type { AkitDetail, GameMeta } from "@/lib/akit"
import { teamColors } from "@/lib/teams"

export const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][n] ?? "th"}`
export const opponentOf = (m: GameMeta) => (m.possession_team === m.home_team_abbr ? m.visitor_team_abbr : m.home_team_abbr)

export const EVENTS: Record<string, [string, string, boolean]> = {
  // label, color, show label on the timeline
  ball_snap: ["Snap", "#e4e4e7", true],
  play_action: ["Play action", "#a1a1aa", false],
  pass_forward: ["Throw", "#2dd4bf", true],
  pass_arrived: ["Arrives", "#a1a1aa", false],
  pass_outcome_caught: ["Catch", "#2dd4bf", true],
  pass_outcome_incomplete: ["Incomplete", "#f87171", true],
  pass_outcome_interception: ["INT", "#f87171", true],
  pass_outcome_touchdown: ["TD", "#2dd4bf", true],
  first_contact: ["Contact", "#a1a1aa", false],
  tackle: ["Tackle", "#e4e4e7", true],
  out_of_bounds: ["Out of bounds", "#e4e4e7", true],
  touchdown: ["Touchdown", "#2dd4bf", true],
  qb_sack: ["Sack", "#f87171", true],
}

/** TV-style score bug: offense, defense, period, clock, down & distance, ball spot. */
export function ScoreBug({ m }: { m: GameMeta }) {
  const opp = opponentOf(m)
  const offHome = m.possession_team === m.home_team_abbr
  const offScore = offHome ? m.pre_snap_home_score : m.pre_snap_visitor_score
  const oppScore = offHome ? m.pre_snap_visitor_score : m.pre_snap_home_score
  const team = (abbr: string, score: number | null, poss: boolean) => (
    <div className="flex items-stretch">
      <span className="w-1.5" style={{ background: teamColors(abbr)[0] }} />
      <span className="flex items-center gap-2 bg-zinc-900/90 px-2.5">
        <span className="font-display text-lg font-bold tracking-wide text-white">{abbr}</span>
        <span className="font-display text-xl font-extrabold text-white tabular-nums">{score ?? "–"}</span>
        {poss && <span className="size-1.5 rounded-full bg-amber-300" aria-label="Possession" />}
      </span>
    </div>
  )
  return (
    <div className="flex h-10 items-stretch overflow-hidden rounded-md border border-white/10 shadow-2xl shadow-black/60">
      {team(m.possession_team, offScore, true)}
      {team(opp, oppScore, false)}
      <span className="flex items-center gap-3 bg-zinc-950/95 px-3 font-display text-base font-semibold tracking-wide text-zinc-200">
        <span>Q{m.quarter}</span>
        <span className="tabular-nums">{m.game_clock}</span>
      </span>
      <span className="flex items-center bg-amber-400 px-3 font-display text-base font-bold tracking-wide text-black uppercase">
        {ord(m.down)} &amp; {m.yards_to_go}
      </span>
      {m.yardline_side && (
        <span className="hidden items-center bg-zinc-950/95 px-3 font-display text-sm font-semibold tracking-wide text-zinc-400 uppercase sm:flex">
          Ball on {m.yardline_side} {m.yardline_number}
        </span>
      )}
    </div>
  )
}

export function Transport({
  length,
  snapFrame,
  events,
  frame,
  playing,
  speed,
  onToggle,
  onRestart,
  onSeek,
  onSpeed,
}: {
  length: number
  snapFrame: number
  events: AkitDetail["events"]
  frame: number
  playing: boolean
  speed: number
  onToggle: () => void
  onRestart: () => void
  onSeek: (f: number) => void
  onSpeed: (s: number) => void
}) {
  const n = length
  const snap = snapFrame
  const marks = events.filter((e) => EVENTS[e.event])
  const t = (f: number) => `${f >= snap ? "+" : "−"}${(Math.abs(f - snap) / 10).toFixed(1)}s`
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 shadow-2xl shadow-black/60 backdrop-blur-md">
      <Button size="icon" className="size-9 rounded-full" onClick={onToggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause /> : <Play />}
      </Button>
      <Button size="icon" variant="ghost" className="size-8 rounded-full text-zinc-400" onClick={onRestart} aria-label="Restart">
        <RotateCcw />
      </Button>
      <div className="relative flex-1 pt-1 pb-4">
        <Slider value={[frame]} max={n - 1} step={1} onValueChange={([v]) => onSeek(v)} />
        {marks.map((e) => {
          const [label, color, show] = EVENTS[e.event]
          const left = `${(e.frame / Math.max(1, n - 1)) * 100}%`
          return (
            <button
              key={`${e.event}-${e.frame}`}
              type="button"
              onClick={() => onSeek(e.frame)}
              className="group absolute top-[22px] -translate-x-1/2"
              style={{ left }}
              title={`${label} ${t(e.frame)}`}
            >
              <i className="mx-auto block h-1.5 w-[2px] rounded-full" style={{ background: color }} />
              {show && <span className="block font-mono text-[9px] whitespace-nowrap text-zinc-400 group-hover:text-white">{label}</span>}
            </button>
          )
        })}
      </div>
      <span className="w-14 text-right font-mono text-xs text-zinc-300 tabular-nums">{t(frame)}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="gap-1.5 font-mono text-xs text-zinc-300">
            <Gauge className="size-3.5" /> {speed}×
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={String(speed)} onValueChange={(v) => onSpeed(Number(v))}>
            {["0.25", "0.5", "1", "2"].map((s) => (
              <DropdownMenuRadioItem key={s} value={s} className="font-mono text-xs">
                {s}× {s === "1" ? "real time" : ""}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
