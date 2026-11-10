"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { DOMINANCE_COLOR, type AkitLeader, type AkitSummary } from "@/lib/akit"

const pct = (v: number) => `${(v * 100).toFixed(0)}%`

/** One-paragraph answer assembled from the summary numbers. */
export function akitHeadline(s: AkitSummary) {
  const q1 = s.quartiles[0]
  const q4 = s.quartiles[s.quartiles.length - 1]
  const best = s.qb.ranks[0]
  const worst = s.qb.ranks[s.qb.ranks.length - 1]
  return (
    <>
      <strong className="font-medium text-zinc-100">Space at the throw helps.</strong> Targets in the top quarter of DSV are caught {pct(q4.catch)} of the time,
      against {pct(q1.catch)} in the bottom quarter.{" "}
      <strong className="font-medium text-zinc-100">Quarterbacks leave it on the table.</strong> Only {pct(s.qb.pct_best)} of throws go to the receiver with the
      most space; those are caught {pct(best.catch)} of the time, against {pct(worst.catch)} for throws to the {worst.label.toLowerCase()} option.
    </>
  )
}

/** Catch rate by DSV-at-release quartile, with 95% bootstrap whiskers. */
export function CatchByDsv({ s }: { s: AkitSummary }) {
  const [hover, setHover] = useState<number | null>(null)
  const H = 200
  const y = (v: number) => H - v * H
  return (
    <div className="flex flex-col gap-3">
      <div className="relative grid h-[230px] grid-cols-4 items-end gap-4 border-b border-white/15 pt-6">
        <div className="pointer-events-none absolute inset-x-0" style={{ top: 24 + y(s.base_catch) }}>
          <div className="border-t border-dashed border-white/25" />
          <span className="absolute -top-4 left-0 text-[11px] text-zinc-500">All targets: {pct(s.base_catch)}</span>
        </div>
        {s.quartiles.map((q) => (
          <div
            key={q.q}
            className="relative flex h-full flex-col items-center justify-end"
            onMouseEnter={() => setHover(q.q)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="mb-1 tabular-nums text-xs font-semibold text-zinc-100">{pct(q.catch)}</span>
            <div className="relative w-full max-w-16" style={{ height: H - y(q.catch) }}>
              <div className="absolute inset-0 rounded-t" style={{ background: DOMINANCE_COLOR, opacity: hover === q.q ? 1 : 0.8 }} />
              <div
                className="absolute left-1/2 w-px -translate-x-1/2 bg-zinc-100"
                style={{ top: y(q.ci_high) - y(q.catch), height: y(q.ci_low) - y(q.ci_high) }}
              />
            </div>
            {hover === q.q && (
              <div className="absolute -top-2 z-10 rounded-md border border-white/10 bg-zinc-900 px-2 py-1 tabular-nums text-[10px] whitespace-nowrap text-zinc-200 shadow-lg">
                n = {q.n} · CI {pct(q.ci_low)}–{pct(q.ci_high)} · {q.yards.toFixed(1)} yd/target
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-4 text-center">
        {s.quartiles.map((q) => (
          <div key={q.q} className="flex flex-col">
            <span className="text-xs text-zinc-300">Q{q.q}</span>
            <span className="tabular-nums text-[10px] text-zinc-500">
              {q.dsv_lo.toFixed(0)}–{q.dsv_hi.toFixed(0)} yd²
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500">Quartiles of DSV at release · whiskers = 95% bootstrap CI · hover for n and yards</p>
    </div>
  )
}

/** Catch rate when the receiver's space shrank vs grew during flight. */
export function SiceSplit({ s }: { s: AkitSummary }) {
  const rows = s.sice_split.filter((r) => r.group !== "flat")
  const flat = s.sice_split.find((r) => r.group === "flat")
  const x = (v: number) => `${(v / 1.0) * 100}%`
  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => (
        <div key={r.group} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-zinc-200">{r.label}</span>
            <span className="tabular-nums text-[11px] text-zinc-500">n = {r.n}</span>
          </div>
          <div className="relative h-7 rounded bg-white/[0.03]">
            <div
              className={cn("absolute inset-y-0 left-0 rounded-r")}
              style={{ width: x(r.catch), background: r.group === "expand" ? DOMINANCE_COLOR : "#71717a" }}
            />
            <div className="absolute top-1/2 h-px -translate-y-1/2 bg-zinc-100" style={{ left: x(r.ci_low), width: `calc(${x(r.ci_high)} - ${x(r.ci_low)})` }} />
            <span className="absolute top-1/2 -translate-y-1/2 pl-2 tabular-nums text-xs font-semibold text-zinc-100" style={{ left: x(r.ci_high) }}>
              {pct(r.catch)} caught
            </span>
          </div>
        </div>
      ))}
      <p className="text-[11px] leading-relaxed text-zinc-500">
        All targets. Line = 95% CI. {flat ? `${flat.n} plays with exactly unchanged DSV omitted.` : ""} Tracking stops 0.5 s after the release, so this
        is the start of the ball&apos;s flight, not the catch point. Space that opens after the ball is out matters far less than space at the throw.
      </p>
    </div>
  )
}

/** How well each measure separates catches from incompletions (AUC, 0.5 = coin flip). */
export function AucChart({ s }: { s: AkitSummary }) {
  const lo = 0.3
  const hi = 0.75
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <div className="flex flex-col gap-2">
      <div className="relative ml-[170px] h-4">
        {[0.3, 0.4, 0.5, 0.6, 0.7].map((t) => (
          <span key={t} className="absolute -translate-x-1/2 tabular-nums text-[10px] text-zinc-500" style={{ left: x(t) }}>
            {t.toFixed(1)}
          </span>
        ))}
      </div>
      {s.auc.map((r) => {
        const isSep = r.metric === "separation_at_pass_forward"
        return (
          <div key={r.metric} className="grid grid-cols-[160px_minmax(0,1fr)] items-center gap-2.5">
            <div className="flex flex-col">
              <span className="text-xs text-zinc-200">{r.label}</span>
              <span className="text-[10px] text-zinc-500">{r.basis}</span>
            </div>
            <div className="relative h-7">
              <div className="absolute inset-y-0 w-px bg-white/25" style={{ left: x(0.5) }} />
              <div className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-zinc-500" style={{ left: x(r.ci_low), width: `calc(${x(r.ci_high)} - ${x(r.ci_low)})` }} />
              <i
                className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-zinc-950"
                style={{ left: x(r.auc), background: isSep ? "#fafafa" : DOMINANCE_COLOR }}
              />
              <span className="absolute top-1/2 -translate-y-1/2 pl-2 tabular-nums text-[11px] text-zinc-200" style={{ left: x(r.ci_high) }}>
                {r.auc.toFixed(2)}
              </span>
            </div>
          </div>
        )
      })}
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
        AUC for catch vs no catch on all targets (95% CI); 0.5 = coin flip. Separation is the distance to the nearest defender; DSV also weighs every
        defender&apos;s speed, direction and body angle. The two agree closely (Spearman ρ = {s.rho_sep_dsv.toFixed(2)}).
      </p>
    </div>
  )
}

export function PositionTable({ s }: { s: AkitSummary }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/10 text-left text-[11px] font-medium text-zinc-500">
          <th className="pb-2 font-medium">Pos</th>
          <th className="pb-2 text-right font-medium">Targets</th>
          <th className="pb-2 text-right font-medium">DSV at throw</th>
          <th className="pb-2 text-right font-medium">DSV +0.5 s</th>
          <th className="pb-2 text-right font-medium">Median SICE</th>
          <th className="pb-2 text-right font-medium">Space grew</th>
          <th className="pb-2 text-right font-medium">Catch</th>
        </tr>
      </thead>
      <tbody className="tabular-nums text-xs text-zinc-300">
        {s.positions.map((p) => (
          <tr key={p.position} className="border-b border-white/[0.04]">
            <td className="py-2 font-sans text-sm text-zinc-100">{p.position}</td>
            <td className="py-2 text-right">{p.n.toLocaleString()}</td>
            <td className="py-2 text-right">{p.dsv_release.toFixed(1)} yd²</td>
            <td className="py-2 text-right">{p.dsv_arrival.toFixed(1)} yd²</td>
            <td className="py-2 text-right">{p.sice_median.toFixed(2)}</td>
            <td className="py-2 text-right">{pct(p.pct_expand)}</td>
            <td className="py-2 text-right">{pct(p.catch)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AkitLeaderboard({
  rows,
  league,
  selected,
  onSelect,
}: {
  rows: AkitLeader[]
  league: number
  selected: number | null
  onSelect: (id: number) => void
}) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, 10)
  const min = Math.min(...rows.map((r) => r.dsv_shrunk)) - 0.5
  const max = Math.max(...rows.map((r) => r.dsv_shrunk))
  const grid = "grid grid-cols-[24px_minmax(0,1fr)_52px_minmax(70px,140px)_48px_52px] gap-3"
  return (
    <div className="flex flex-col">
      <div className={`${grid} border-b border-white/10 pb-2 text-[11px] font-medium text-zinc-500`}>
        <span>#</span>
        <span>Receiver</span>
        <span className="text-right">Tgts</span>
        <span className="col-span-2 text-right">DSV @ release (shrunk)</span>
        <span className="text-right">Catch</span>
      </div>
      {shown.map((r, i) => (
        <button
          key={r.nfl_id}
          type="button"
          onClick={() => onSelect(r.nfl_id)}
          className={cn(
            `${grid} items-center border-b border-white/[0.04] py-2 text-left transition-colors hover:bg-white/[0.04]`,
            selected === r.nfl_id && "bg-white/[0.06]"
          )}
        >
          <span className="tabular-nums text-xs text-zinc-500">{i + 1}</span>
          <span className="truncate text-sm text-zinc-100">
            {r.display_name} <span className="text-xs text-zinc-500">{r.nfl_position}</span>
          </span>
          <span className="text-right tabular-nums text-xs text-zinc-400">{r.targets}</span>
          <span className="relative flex h-5 items-center">
            <span className="absolute h-2.5 rounded-r-sm" style={{ left: 0, width: `${((r.dsv_shrunk - min) / (max - min)) * 100}%`, background: DOMINANCE_COLOR }} />
          </span>
          <span className="text-right tabular-nums text-[11px] text-zinc-200">{r.dsv_shrunk.toFixed(1)}</span>
          <span className="text-right tabular-nums text-[11px] text-zinc-400">{pct(r.catch)}</span>
        </button>
      ))}
      {rows.length > 10 && (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-2 self-start text-xs text-zinc-400 hover:text-zinc-200">
          {all ? "Show top 10" : `Show all ${rows.length}`}
        </button>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        Mean DSV at the throw on each receiver&apos;s targets, shrunk toward the league mean ({league.toFixed(1)} yd²) with 15 pseudo-targets. Minimum
        15 targets. Bars start at the lowest qualifier, not zero.
      </p>
    </div>
  )
}

/** Catch rate by how the target ranked among his teammates in DSV at the throw. */
export function QbDecision({ s }: { s: AkitSummary }) {
  const x = (v: number) => `${(v / 1.15) * 100}%`
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-4xl font-medium text-zinc-50 tabular-nums">{pct(s.qb.pct_best)}</span>
        <span className="text-sm text-zinc-400">of throws went to the receiver with the most space</span>
      </div>
      {s.qb.ranks.map((r) => (
        <div key={r.rank} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3">
          <div className="flex flex-col">
            <span className="text-sm text-zinc-200">{r.label}</span>
            <span className="text-[11px] text-zinc-500 tabular-nums">{r.n.toLocaleString()} throws</span>
          </div>
          <div className="relative h-7 rounded bg-white/[0.03]">
            <div className="absolute inset-y-0 left-0 rounded-r" style={{ width: x(r.catch), background: r.rank === 1 ? DOMINANCE_COLOR : "#71717a" }} />
            <div className="absolute top-1/2 h-px -translate-y-1/2 bg-zinc-100" style={{ left: x(r.ci_low), width: `calc(${x(r.ci_high)} - ${x(r.ci_low)})` }} />
            <span className="absolute top-1/2 -translate-y-1/2 pl-2 text-xs font-medium text-zinc-100 tabular-nums" style={{ left: x(r.ci_high) }}>
              {pct(r.catch)} caught · {r.yards.toFixed(1)} yd
            </span>
          </div>
        </div>
      ))}
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Rank of the targeted receiver among all route runners on the play by DSV at the throw. When the QB passed up the most open man, that receiver
        had a median {s.qb.gap_median.toFixed(1)} yd² more space. Line = 95% CI. Reads, progressions and pressure are not modeled.
      </p>
    </div>
  )
}
