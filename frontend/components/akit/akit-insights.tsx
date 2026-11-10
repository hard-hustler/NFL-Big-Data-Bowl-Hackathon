"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { DOMINANCE_COLOR, NEUTRAL_COLOR, rateColor, type AkitLeader, type AkitSummary } from "@/lib/akit"
import { dim, ease, useReveal, useTooltip } from "./chart-kit"
import { RateScale } from "./control-charts"
import { PlayerFace } from "./player-face"

const pct = (v: number) => `${(v * 100).toFixed(0)}%`
const ci = (lo: number, hi: number) => `${pct(lo)}–${pct(hi)}`
const QUARTER = ["Least space", "Some space", "More space", "Most space"]
const RANK = ["Most open receiver", "2nd most open", "3rd most open", "4th or lower"]
const MEASURE: Record<string, [string, string]> = {
  separation_at_pass_forward: ["Separation at the throw", "distance to closest defender"],
  dsv_release: ["Open space at the throw", "our measure"],
  dsv_arrival: ["Open space 0.5 s later", "our measure"],
  sice: ["Change in space after the throw", "later ÷ at the throw"],
}

/** One-paragraph answer assembled from the summary numbers. */
export function akitHeadline(s: AkitSummary) {
  const q1 = s.quartiles[0]
  const q4 = s.quartiles[s.quartiles.length - 1]
  const best = s.qb.ranks[0]
  const worst = s.qb.ranks[s.qb.ranks.length - 1]
  return (
    <>
      <strong className="font-medium text-zinc-100">Space helps.</strong> When the receiver has the most open space as the ball is thrown, it&apos;s caught{" "}
      {pct(q4.catch)} of the time, versus {pct(q1.catch)} with the least.{" "}
      <strong className="font-medium text-zinc-100">QBs often miss it.</strong> Only {pct(s.qb.pct_best)} of throws go to the most open receiver. Those are
      caught {pct(best.catch)} of the time, versus {pct(worst.catch)} when the QB picks one of the least open.
    </>
  )
}

/** Catch rate by DSV-at-release quartile, with 95% bootstrap whiskers. */
export function CatchByDsv({ s }: { s: AkitSummary }) {
  const { ref, shown } = useReveal()
  const { box, bind, node, active } = useTooltip()
  const H = 200
  const y = (v: number) => H - v * H
  return (
    <div ref={ref} className="flex flex-col gap-3">
      <div ref={box} className="relative grid h-[230px] grid-cols-4 items-end gap-4 border-b border-white/15 pt-6">
        <div className="pointer-events-none absolute inset-x-0" style={{ top: 24 + y(s.base_catch) }}>
          <div className="border-t border-dashed border-white/25" />
          <span className="absolute -top-4 left-0 text-[11px] text-zinc-500">Average: {pct(s.base_catch)} caught</span>
        </div>
        {s.quartiles.map((q, i) => {
          const key = `q${q.q}`
          const color = rateColor(q.catch, s.base_catch)
          return (
            <div
              key={q.q}
              className="relative flex h-full cursor-default flex-col items-center justify-end"
              {...bind(key, {
                title: QUARTER[q.q - 1],
                color,
                rows: [
                  ["Open space", `${q.dsv_lo.toFixed(0)}–${q.dsv_hi.toFixed(0)} yd²`],
                  ["Caught", pct(q.catch)],
                  ["Likely range", ci(q.ci_low, q.ci_high)],
                  ["Yards / target", q.yards.toFixed(1)],
                  ["Targets", q.n.toLocaleString()],
                ],
              })}
            >
              <span className="mb-1 text-xs font-semibold text-zinc-100 tabular-nums" style={{ ...ease(i + 3, 500), opacity: shown ? dim(active, key) : 0 }}>
                {pct(q.catch)}
              </span>
              <div
                className="relative w-full max-w-16"
                style={{ ...ease(i, 800, "height, opacity"), height: shown ? H - y(q.catch) : 0, opacity: dim(active, key) }}
              >
                <div className="absolute inset-0 rounded-t" style={{ background: color }} />
                <div
                  className="absolute left-1/2 w-px -translate-x-1/2 bg-zinc-100"
                  style={{ top: y(q.ci_high) - y(q.catch), height: y(q.ci_low) - y(q.ci_high), opacity: shown ? 1 : 0, transition: "opacity 300ms 700ms" }}
                />
              </div>
            </div>
          )
        })}
        {node}
      </div>
      <div className="grid grid-cols-4 gap-4 text-center">
        {s.quartiles.map((q) => (
          <div key={q.q} className="flex flex-col">
            <span className="text-xs text-zinc-300">{QUARTER[q.q - 1]}</span>
            <span className="text-[10px] text-zinc-500 tabular-nums">
              {q.dsv_lo.toFixed(0)}–{q.dsv_hi.toFixed(0)} yd²
            </span>
          </div>
        ))}
      </div>
      <RateScale base={s.base_catch} />
      <p className="text-xs text-zinc-400">The thin line on each bar shows the range we are 95% confident in. Hover a bar for details.</p>
    </div>
  )
}

/** Horizontal catch-rate bars shared by the SICE split and QB decision charts. */
function RateBars({
  rows,
  base,
  scale,
  label,
}: {
  rows: { key: string; label: string; sub: string; catch: number; ci_low: number; ci_high: number; n: number; yards: number }[]
  base: number
  scale: number
  label: (r: { catch: number; yards: number }) => string
}) {
  const { ref, shown } = useReveal()
  const { box, bind, node, active } = useTooltip()
  const x = (v: number) => `${(v / scale) * 100}%`
  return (
    <div ref={ref} className="flex flex-col gap-3">
      <div ref={box} className="relative flex flex-col gap-3">
        {rows.map((r, i) => {
          const color = rateColor(r.catch, base)
          return (
            <div
              key={r.key}
              className="grid cursor-default grid-cols-[minmax(0,140px)_minmax(0,1fr)] items-center gap-3"
              style={{ opacity: dim(active, r.key), transition: "opacity 150ms" }}
              {...bind(r.key, {
                title: r.label,
                color,
                rows: [
                  ["Caught", pct(r.catch)],
                  ["Likely range", ci(r.ci_low, r.ci_high)],
                  ["Yards / target", r.yards.toFixed(1)],
                  ["Throws", r.n.toLocaleString()],
                ],
              })}
            >
              <div className="flex flex-col">
                <span className="text-sm text-zinc-200">{r.label}</span>
                <span className="text-[11px] text-zinc-500 tabular-nums">{r.sub}</span>
              </div>
              <div className="relative h-7 rounded bg-white/[0.03]">
                <div className="absolute inset-y-0 left-0 rounded-r" style={{ ...ease(i, 800, "width"), width: shown ? x(r.catch) : "0%", background: color }} />
                <div
                  className="absolute top-1/2 h-px -translate-y-1/2 bg-zinc-100"
                  style={{ left: x(r.ci_low), width: `calc(${x(r.ci_high)} - ${x(r.ci_low)})`, opacity: shown ? 1 : 0, transition: `opacity 300ms ${700 + i * 70}ms` }}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 pl-2 text-xs font-medium text-zinc-100 tabular-nums"
                  style={{ left: x(r.ci_high), opacity: shown ? 1 : 0, transition: `opacity 300ms ${700 + i * 70}ms` }}
                >
                  {label(r)}
                </span>
              </div>
            </div>
          )
        })}
        {node}
      </div>
      <RateScale base={base} />
    </div>
  )
}

/** Catch rate when the receiver's space shrank vs grew after the release. */
export function SiceSplit({ s }: { s: AkitSummary }) {
  const flat = s.sice_split.find((r) => r.group === "flat")
  const rows = s.sice_split
    .filter((r) => r.group !== "flat")
    .map((r) => ({ ...r, key: r.group, label: r.group === "expand" ? "Receiver gained space" : "Receiver lost space", sub: `${r.n.toLocaleString()} throws` }))
  return (
    <div className="flex flex-col gap-3">
      <RateBars rows={rows} base={s.base_catch} scale={1} label={(r) => `${pct(r.catch)} caught`} />
      <p className="text-xs leading-relaxed text-zinc-400">
        Measured over the first half-second after the throw (the tracking data stops there). Compare with Finding 1: space at the throw matters far
        more than space gained afterwards.
      </p>
    </div>
  )
}

/** Catch rate by how the target ranked among his teammates in DSV at the throw. */
export function QbDecision({ s }: { s: AkitSummary }) {
  const rows = s.qb.ranks.map((r) => ({ ...r, key: `r${r.rank}`, label: RANK[r.rank - 1] ?? r.label, sub: `${r.n.toLocaleString()} throws` }))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-4xl font-medium text-zinc-50 tabular-nums">{pct(s.qb.pct_best)}</span>
        <span className="text-sm text-zinc-400">of throws went to the receiver with the most space</span>
      </div>
      <RateBars rows={rows} base={s.base_catch} scale={1.15} label={(r) => `${pct(r.catch)} caught · ${r.yards.toFixed(1)} yd`} />
      <p className="text-xs leading-relaxed text-zinc-400">
        When the QB skipped the most open receiver, that receiver typically had {s.qb.gap_median.toFixed(1)} yd² more space than the one who got the
        ball. We don&apos;t account for the QB&apos;s reads or pass rush pressure.
      </p>
    </div>
  )
}

/** How well each measure separates catches from incompletions (AUC, 0.5 = coin flip). */
export function AucChart({ s }: { s: AkitSummary }) {
  const { ref, shown } = useReveal()
  const { box, bind, node, active } = useTooltip()
  const lo = 0.3
  const hi = 0.75
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <div ref={ref} className="flex flex-col gap-2">
      <div className="relative ml-[170px] h-4">
        {[0.3, 0.4, 0.5, 0.6, 0.7].map((t) => (
          <span key={t} className="absolute -translate-x-1/2 text-[10px] text-zinc-500 tabular-nums" style={{ left: x(t) }}>
            {t.toFixed(1)}
          </span>
        ))}
      </div>
      <div ref={box} className="relative flex flex-col gap-2">
        {s.auc.map((r, i) => {
          const isSep = r.metric === "separation_at_pass_forward"
          const [name, basis] = MEASURE[r.metric] ?? [r.label, r.basis]
          const color = isSep ? NEUTRAL_COLOR : DOMINANCE_COLOR
          return (
            <div
              key={r.metric}
              className="grid cursor-default grid-cols-[160px_minmax(0,1fr)] items-center gap-2.5"
              style={{ opacity: dim(active, r.metric), transition: "opacity 150ms" }}
              {...bind(r.metric, {
                title: name,
                color,
                rows: [
                  ["Score", r.auc.toFixed(2)],
                  ["Likely range", `${r.ci_low.toFixed(2)}–${r.ci_high.toFixed(2)}`],
                  ["Better than a coin flip by", `${((r.auc - 0.5) * 100).toFixed(0)} pts`],
                ],
              })}
            >
              <div className="flex flex-col">
                <span className="text-xs text-zinc-200">{name}</span>
                <span className="text-[10px] text-zinc-500">{basis}</span>
              </div>
              <div className="relative h-7">
                <div className="absolute inset-y-0 w-px bg-white/25" style={{ left: x(0.5) }} />
                <div
                  className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-zinc-500"
                  style={{ left: x(r.ci_low), width: `calc(${x(r.ci_high)} - ${x(r.ci_low)})`, opacity: shown ? 1 : 0, transition: `opacity 400ms ${600 + i * 80}ms` }}
                />
                <i
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-zinc-950"
                  style={{ ...ease(i, 900, "left, opacity"), left: shown ? x(r.auc) : x(0.5), opacity: shown ? 1 : 0, background: color }}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 pl-2 text-[11px] text-zinc-200 tabular-nums"
                  style={{ left: x(r.ci_high), opacity: shown ? 1 : 0, transition: `opacity 300ms ${800 + i * 80}ms` }}
                >
                  {r.auc.toFixed(2)}
                </span>
              </div>
            </div>
          )
        })}
        {node}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
        Separation is just the distance to the closest defender. Open space also looks at where every defender is running and facing. Both predict
        catches well and mostly agree; the change in space after the throw is no better than a coin flip.
      </p>
    </div>
  )
}

export function PositionTable({ s }: { s: AkitSummary }) {
  const { ref, shown } = useReveal<HTMLTableElement>()
  return (
    <table ref={ref} className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/10 text-left text-[11px] font-medium text-zinc-500">
          <th className="pb-2 font-medium">Pos</th>
          <th className="pb-2 text-right font-medium">Targets</th>
          <th className="pb-2 text-right font-medium">Open space at throw</th>
          <th className="pb-2 text-right font-medium">0.5 s later</th>
          <th className="pb-2 text-right font-medium">Gained space</th>
          <th className="pb-2 text-right font-medium">Caught</th>
        </tr>
      </thead>
      <tbody className="text-xs text-zinc-300 tabular-nums">
        {s.positions.map((p, i) => (
          <tr
            key={p.position}
            className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.04]"
            style={{ ...ease(i, 500, "opacity, transform"), opacity: shown ? 1 : 0, transform: shown ? "none" : "translateY(6px)" }}
          >
            <td className="py-2 font-sans text-sm text-zinc-100">{p.position}</td>
            <td className="py-2 text-right">{p.n.toLocaleString()}</td>
            <td className="py-2 text-right">{p.dsv_release.toFixed(1)} yd²</td>
            <td className="py-2 text-right">{p.dsv_arrival.toFixed(1)} yd²</td>
            <td className="py-2 text-right">{pct(p.pct_expand)}</td>
            <td className="py-2 text-right">
              <span className="rounded px-1.5 py-0.5 text-white" style={{ background: rateColor(p.catch, s.base_catch) }}>
                {pct(p.catch)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AkitLeaderboard({
  rows,
  league,
  baseCatch,
  selected,
  onSelect,
}: {
  rows: AkitLeader[]
  league: number
  /** League catch rate: midpoint of the shared completion color scale. */
  baseCatch: number
  selected: number | null
  onSelect: (id: number) => void
}) {
  const [all, setAll] = useState(false)
  const { ref, shown } = useReveal()
  const { box, bind, node, active } = useTooltip()
  const list = all ? rows : rows.slice(0, 10)
  const min = Math.min(...rows.map((r) => r.dsv_shrunk)) - 0.5
  const max = Math.max(...rows.map((r) => r.dsv_shrunk))
  const grid = "grid grid-cols-[24px_minmax(0,1fr)_52px_minmax(70px,140px)_48px_52px] gap-3"
  return (
    <div ref={ref} className="flex flex-col">
      <div className={`${grid} border-b border-white/10 pb-2 text-[11px] font-medium text-zinc-500`}>
        <span>#</span>
        <span>Receiver</span>
        <span className="text-right">Tgts</span>
        <span className="col-span-2 text-right">Open space at throw (yd²)</span>
        <span className="text-right">Caught</span>
      </div>
      <div ref={box} className="relative">
        {list.map((r, i) => {
          const key = String(r.nfl_id)
          return (
            <button
              key={r.nfl_id}
              type="button"
              onClick={() => onSelect(r.nfl_id)}
              {...bind(key, {
                title: `${r.display_name} · ${r.nfl_position}`,
                color: DOMINANCE_COLOR,
                rows: [
                  ["Open space (avg)", `${r.dsv.toFixed(1)} yd²`],
                  ["Adjusted for sample size", `${r.dsv_shrunk.toFixed(1)} yd²`],
                  ["vs league average", `${r.dsv_shrunk - league >= 0 ? "+" : ""}${(r.dsv_shrunk - league).toFixed(1)} yd²`],
                  ["Caught", pct(r.catch)],
                  ["Targets", String(r.targets)],
                ],
              })}
              className={cn(
                `${grid} w-full items-center border-b border-white/[0.04] py-2 text-left transition-colors hover:bg-white/[0.04]`,
                selected === r.nfl_id && "bg-white/[0.06]"
              )}
              style={{ opacity: dim(active, key), transition: "opacity 150ms, background-color 150ms" }}
            >
              <span className="text-xs text-zinc-500 tabular-nums">{i + 1}</span>
              <span className="flex min-w-0 items-center gap-2 text-sm text-zinc-100">
                <PlayerFace id={r.nfl_id} name={r.display_name} size={24} />
                <span className="truncate">
                  {r.display_name} <span className="text-xs text-zinc-500">{r.nfl_position}</span>
                </span>
              </span>
              <span className="text-right text-xs text-zinc-400 tabular-nums">{r.targets}</span>
              <span className="relative flex h-5 items-center">
                <span
                  className="absolute h-2.5 rounded-r-sm"
                  style={{
                    ...ease(Math.min(i, 10), 800, "width"),
                    left: 0,
                    width: shown ? `${((r.dsv_shrunk - min) / (max - min)) * 100}%` : "0%",
                    background: DOMINANCE_COLOR,
                  }}
                />
              </span>
              <span className="text-right text-[11px] text-zinc-200 tabular-nums">{r.dsv_shrunk.toFixed(1)}</span>
              <span className="text-right">
                <span className="rounded px-1.5 py-0.5 text-[11px] text-white tabular-nums" style={{ background: rateColor(r.catch, baseCatch) }}>
                  {pct(r.catch)}
                </span>
              </span>
            </button>
          )
        })}
        {node}
      </div>
      {rows.length > 10 && (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-2 self-start text-xs text-zinc-400 hover:text-zinc-200">
          {all ? "Show top 10" : `Show all ${rows.length}`}
        </button>
      )}
      <p className="mt-3 text-xs leading-relaxed text-zinc-400">
        Receivers with few targets are pulled toward the league average ({league.toFixed(1)} yd²) so a handful of lucky plays can&apos;t top the list.
        Minimum 15 targets.
      </p>
    </div>
  )
}
