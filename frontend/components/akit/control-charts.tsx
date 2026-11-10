"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { DEFENSE_COLOR, DOMINANCE_COLOR, NEUTRAL_COLOR, rateColor } from "@/lib/akit"
import type { ControlData, MeanCI } from "@/lib/control"
import { dim, ease, useReveal, useTooltip } from "./chart-kit"

// Same theme as the rest of the dashboard: teal = receiver wins, orange = defense wins, grey = in between.
const COMPLETE = DOMINANCE_COLOR
const INCOMPLETE = DEFENSE_COLOR
const MID = NEUTRAL_COLOR
const pct = (v: number) => `${Math.round(v * 100)}%`
const ci = (lo: number, hi: number) => `${pct(lo)}–${pct(hi)}`
/** Line-draw entry animation for SVG paths (needs pathLength={1}). */
const draw = (shown: boolean, i = 0) => ({
  strokeDasharray: 1,
  strokeDashoffset: shown ? 0 : 1,
  transition: `stroke-dashoffset 1200ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 150}ms`,
})

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-full" style={{ background: color }} /> {label}
        </span>
      ))}
    </div>
  )
}

export function RateScale({ base }: { base: number }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
      <span>20%</span>
      <span
        className="h-2 w-40 rounded-full"
        style={{ background: `linear-gradient(90deg, ${rateColor(0.2, base)}, ${rateColor(base, base)}, ${rateColor(0.95, base)})` }}
      />
      <span>95% caught</span>
      <span className="text-zinc-600">· grey = average ({pct(base)})</span>
    </div>
  )
}

/** Pre-work fig 02: same separation, split into control thirds. */
export function SameSeparation({ d }: { d: ControlData }) {
  const { ref, shown } = useReveal()
  const heat = useTooltip()
  const line = useTooltip()
  const seps = ["0-1", "1-2", "2-3", "3-4", "4-6", "6-10", "10+"]
  const thirds: ["low" | "mid" | "high", string, string][] = [
    ["high", "Most control", COMPLETE],
    ["mid", "Middle", MID],
    ["low", "Least control", INCOMPLETE],
  ]
  const get = (s: string, t: string) => d.sameSep.find((c) => c.sep === s && c.third === t)!
  const tipFor = (s: string, label: string, color: string) => {
    const c = get(s, thirds.find((t) => t[1] === label)![0])
    return {
      title: `${s} yd separation · ${label.toLowerCase()}`,
      color,
      rows: [
        ["Caught", pct(c.rate)],
        ["Likely range", ci(c.lo, c.hi)],
        ["Throws", c.n.toLocaleString()],
      ] as [string, string][],
    }
  }
  const W = 520
  const H = 260
  const L = 48
  const R = 132
  const B = 40
  const x = (i: number) => L + (i / (seps.length - 1)) * (W - L - R)
  const y = (v: number) => 12 + (1 - v) * (H - 12 - B)
  const last = seps[seps.length - 1]
  // Direct labels at the end of each line, nudged apart so close finishes stay readable.
  const ends = thirds
    .map(([t, label, color]) => ({ t, label, color, rate: get(last, t).rate, ly: y(get(last, t).rate) }))
    .sort((a, b) => a.ly - b.ly)
  ends.forEach((e, i) => {
    if (i > 0) e.ly = Math.max(e.ly, ends[i - 1].ly + 14)
  })
  // Headline callout: the gap between most and least control at 1–2 yd.
  const gapHi = get("1-2", "high")
  const gapLo = get("1-2", "low")
  return (
    <div ref={ref} className="flex flex-col gap-4">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <div ref={heat.box} className="relative grid grid-cols-[84px_repeat(7,minmax(0,1fr))] gap-1">
            {thirds.map(([t, label], r) => (
              <div key={t} className="contents">
                <span className="flex items-center text-xs text-zinc-400">{label}</span>
                {seps.map((s, i) => {
                  const c = get(s, t)
                  const key = `${t}-${s}`
                  return (
                    <div
                      key={s}
                      {...heat.bind(key, tipFor(s, label, rateColor(c.rate, d.base_rate)))}
                      className="flex h-14 cursor-default flex-col items-center justify-center rounded-sm text-white hover:ring-2 hover:ring-white/60"
                      style={{
                        ...ease(i + r * 2, 500, "opacity, transform"),
                        background: rateColor(c.rate, d.base_rate),
                        opacity: shown ? dim(heat.active, key) : 0,
                        transform: shown ? "none" : "scale(0.85)",
                      }}
                    >
                      <span className="text-sm font-medium tabular-nums">{pct(c.rate)}</span>
                      <span className="text-[10px] opacity-75 tabular-nums">n={c.n}</span>
                    </div>
                  )
                })}
              </div>
            ))}
            <span />
            {seps.map((s) => (
              <span key={s} className="pt-1 text-center text-[11px] text-zinc-500">
                {s}
              </span>
            ))}
            {heat.node}
          </div>
          <span className="text-center text-[11px] text-zinc-500">Separation when the ball is thrown (yards)</span>
        </div>
        <div ref={line.box} className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Completion rate by separation for each control third">
            {[0.2, 0.4, 0.6, 0.8, 1].map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R + 8} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" />
                <text x={L - 6} y={y(v) + 3} textAnchor="end" className="fill-zinc-500 text-[9px]">{pct(v)}</text>
              </g>
            ))}
            {seps.map((s, i) => (
              <text key={s} x={x(i)} y={H - B + 16} textAnchor="middle" className="fill-zinc-500 text-[9px]">{s}</text>
            ))}
            <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" className="fill-zinc-400 text-[10px]">Separation when the ball is thrown (yards)</text>
            <text x={12} y={(H - B) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(H - B) / 2})`} className="fill-zinc-400 text-[10px]">
              Passes caught
            </text>
            {thirds.map(([t, label, color], k) => {
              const pts = seps.map((s, i) => [s, x(i) + (k - 1) * 4, get(s, t)] as const)
              const faded = line.active && !line.active.startsWith(t)
              return (
                <g key={t} style={{ opacity: faded ? 0.25 : 1, transition: "opacity 150ms" }}>
                  <path
                    d={pts.map(([, px, c], i) => `${i ? "L" : "M"}${px},${y(c.rate)}`).join(" ")}
                    pathLength={1}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    style={draw(shown, k)}
                  />
                  {pts.map(([s, px, c], i) => (
                    <g key={s} style={{ ...ease(i + 6, 400, "opacity"), opacity: shown ? 1 : 0 }} {...line.bind(`${t}-${s}`, tipFor(s, label, color))}>
                      <line x1={px} x2={px} y1={y(c.hi)} y2={y(c.lo)} stroke={color} strokeWidth={1.2} opacity={0.7} />
                      <circle cx={px} cy={y(c.rate)} r={line.active === `${t}-${s}` ? 6 : 4} fill={color} stroke="#0e1014" strokeWidth={2} />
                      <circle cx={px} cy={y(c.rate)} r={10} fill="transparent" className="cursor-default" />
                    </g>
                  ))}
                </g>
              )
            })}
            {/* 1–2 yd callout: same separation, roughly double the catch rate. */}
            <g pointerEvents="none" style={{ opacity: shown ? 1 : 0, transition: "opacity 400ms ease 1300ms" }}>
              <line x1={x(1) + 14} x2={x(1) + 14} y1={y(gapHi.rate)} y2={y(gapLo.rate)} stroke="#e4e4e7" strokeDasharray="3 3" opacity={0.6} />
              <line x1={x(1) + 10} x2={x(1) + 18} y1={y(gapHi.rate)} y2={y(gapHi.rate)} stroke="#e4e4e7" opacity={0.6} />
              <line x1={x(1) + 10} x2={x(1) + 18} y1={y(gapLo.rate)} y2={y(gapLo.rate)} stroke="#e4e4e7" opacity={0.6} />
              <text x={x(1) - 8} y={y(gapHi.rate) - 9} textAnchor="middle" className="fill-zinc-100 text-[10px] font-medium">{pct(gapHi.rate)}</text>
              <text x={x(1) - 8} y={y(gapLo.rate) + 16} textAnchor="middle" className="fill-zinc-100 text-[10px] font-medium">{pct(gapLo.rate)}</text>
              <text x={x(1) + 22} y={(y(gapHi.rate) + y(gapLo.rate)) / 2 + 3} className="fill-zinc-300 text-[9px]">
                2× the catches
              </text>
            </g>
            {/* Line-end labels */}
            <g pointerEvents="none" style={{ opacity: shown ? 1 : 0, transition: "opacity 400ms ease 1200ms" }}>
              {ends.map((e) => (
                <g key={e.t}>
                  <circle cx={x(seps.length - 1) + 16} cy={e.ly} r={3.5} fill={e.color} />
                  <text x={x(seps.length - 1) + 24} y={e.ly + 3} className="fill-zinc-200 text-[10px]">
                    {e.label} · {pct(e.rate)}
                  </text>
                </g>
              ))}
            </g>
          </svg>
          {line.node}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Legend items={thirds.map(([, label, color]) => [label, color])} />
        <RateScale base={d.base_rate} />
      </div>
    </div>
  )
}

/** Pre-work fig 03: every target as a point, binned completion behind. */
export function SeparationVsControl({ d }: { d: ControlData }) {
  const { ref, shown } = useReveal()
  const { box, bind, node, active } = useTooltip()
  const W = 560
  const H = 350
  const L = 40
  const B = 42
  const x = (v: number) => L + (v / 15) * (W - L - 10)
  const y = (v: number) => 8 + ((1 - v) / 0.85) * (H - B - 8)
  return (
    <div ref={ref} className="flex flex-col gap-3">
      <div ref={box} className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Separation versus catch-point control">
          <g style={{ opacity: shown ? 1 : 0, transition: "opacity 900ms ease 500ms" }}>
            {d.joint.points.map(([s, c, k], i) => (
              <circle key={i} cx={x(s)} cy={y(c)} r={1.3} fill={k ? COMPLETE : INCOMPLETE} opacity={active ? 0.15 : 0.4} pointerEvents="none" />
            ))}
          </g>
          {d.joint.cells.map((c, i) => {
            const key = `${c.x0}-${c.y0}`
            const hot = active === key
            return (
              <rect
                key={key}
                x={x(c.x0)}
                y={y(c.y1)}
                width={x(c.x1) - x(c.x0)}
                height={y(c.y0) - y(c.y1)}
                fill={rateColor(c.rate, d.base_rate)}
                stroke={hot ? "#fafafa" : "none"}
                strokeWidth={1.5}
                className="cursor-crosshair"
                style={{ opacity: shown ? (hot ? 0.9 : 0.5) : 0, transition: `opacity 500ms ease ${Math.min(i, 80) * 6}ms` }}
                {...bind(key, {
                  title: `${c.x0}–${c.x1} yards apart · control ${c.y0.toFixed(2)}–${c.y1.toFixed(2)}`,
                  color: rateColor(c.rate, d.base_rate),
                  rows: [
                    ["Caught", pct(c.rate)],
                    ["Throws in this area", c.n.toLocaleString()],
                  ],
                })}
              />
            )
          })}
          <line x1={L} x2={W - 10} y1={y(0.5)} y2={y(0.5)} stroke="#e4e4e7" strokeDasharray="4 3" opacity={0.6} pointerEvents="none" />
          <text x={W - 12} y={y(0.5) - 4} textAnchor="end" className="fill-zinc-300 text-[10px]">toss-up (0.5)</text>
          {[0, 2, 4, 6, 8, 10, 12, 14].map((v) => (
            <text key={v} x={x(v)} y={H - B + 14} textAnchor="middle" className="fill-zinc-500 text-[10px]">{v}</text>
          ))}
          {[0.2, 0.4, 0.6, 0.8, 1].map((v) => (
            <text key={v} x={L - 6} y={y(v) + 3} textAnchor="end" className="fill-zinc-500 text-[10px]">{v.toFixed(1)}</text>
          ))}
          <text x={(W + L) / 2} y={H - 4} textAnchor="middle" className="fill-zinc-400 text-[10px]">Separation when the ball is thrown (yards)</text>
          <text x={10} y={H / 2} textAnchor="middle" transform={`rotate(-90 10 ${H / 2})`} className="fill-zinc-400 text-[10px]">Control of landing spot</text>
        </svg>
        {node}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Legend items={[["Complete", COMPLETE], ["Incomplete / INT", INCOMPLETE]]} />
        <RateScale base={d.base_rate} />
      </div>
      <p className="text-xs text-zinc-400">Hover the shaded areas to see how often passes there were caught.</p>
    </div>
  )
}

/** One small multiple of the release timeline with a hover crosshair. */
function SmallTimeline({
  rows,
  label,
  fmt,
  shown,
  index,
}: {
  rows: (MeanCI & { t: number; outcome: string })[]
  label: string
  fmt: (v: number) => string
  shown: boolean
  index: number
}) {
  const [hoverT, setHoverT] = useState<number | null>(null)
  const W = 420
  const H = 230
  const L = 40
  const R = 8
  const ts = [...new Set(rows.map((r) => r.t))].sort((a, b) => a - b)
  const lo = Math.min(...rows.map((r) => r.lo))
  const hi = Math.max(...rows.map((r) => r.hi))
  const pad = (hi - lo) * 0.08
  const x = (t: number) => L + ((t - ts[0]) / (ts[ts.length - 1] - ts[0])) * (W - L - R)
  const y = (v: number) => 8 + ((hi + pad - v) / (hi - lo + 2 * pad)) * (H - 36)
  const ticks = [lo, (lo + hi) / 2, hi]
  const at = (o: string) => rows.find((r) => r.outcome === o && r.t === hoverT)
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const t = ts.reduce((best, v) => (Math.abs(x(v) - px) < Math.abs(x(best) - px) ? v : best), ts[0])
    setHoverT(t)
  }
  const c = at("complete")
  const inc = at("incomplete")
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-zinc-300">{label}</span>
        <span className="text-[11px] text-zinc-500 tabular-nums">
          {hoverT != null && c && inc ? (
            <>
              {hoverT > 0 ? "+" : ""}
              {hoverT.toFixed(1)} s · <span style={{ color: COMPLETE }}>{fmt(c.mean)}</span> vs <span style={{ color: INCOMPLETE }}>{fmt(inc.mean)}</span>
            </>
          ) : (
            "hover for values"
          )}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair" role="img" aria-label={label} onMouseMove={onMove} onMouseLeave={() => setHoverT(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" />
            <text x={L - 5} y={y(v) + 3} textAnchor="end" className="fill-zinc-500 text-[9px]">{fmt(v)}</text>
          </g>
        ))}
        <line x1={x(0)} x2={x(0)} y1={6} y2={H - 28} stroke="#e4e4e7" strokeDasharray="3 3" opacity={0.5} />
        <text x={x(0)} y={H - 18} textAnchor="middle" className="fill-zinc-400 text-[9px]">throw</text>
        {[-1, -0.5, 0.4].map((t) => (
          <text key={t} x={x(t)} y={H - 6} textAnchor="middle" className="fill-zinc-500 text-[9px]">{t > 0 ? `+${t}` : t} s</text>
        ))}
        {(["incomplete", "complete"] as const).map((o, k) => {
          const s = rows.filter((r) => r.outcome === o).sort((a, b) => a.t - b.t)
          const color = o === "complete" ? COMPLETE : INCOMPLETE
          const band = [...s.map((r) => `${x(r.t)},${y(r.hi)}`), ...s.slice().reverse().map((r) => `${x(r.t)},${y(r.lo)}`)].join(" ")
          return (
            <g key={o}>
              <polygon points={band} fill={color} style={{ opacity: shown ? 0.18 : 0, transition: `opacity 600ms ease ${900 + index * 150}ms` }} />
              <path
                d={s.map((r, i) => `${i ? "L" : "M"}${x(r.t)},${y(r.mean)}`).join(" ")}
                pathLength={1}
                fill="none"
                stroke={color}
                strokeWidth={2}
                style={draw(shown, index + k)}
              />
            </g>
          )
        })}
        {hoverT != null && c && inc && (
          <g pointerEvents="none">
            <line x1={x(hoverT)} x2={x(hoverT)} y1={6} y2={H - 28} stroke="#fafafa" strokeWidth={1} opacity={0.6} />
            <circle cx={x(hoverT)} cy={y(c.mean)} r={4.5} fill={COMPLETE} stroke="#0e1014" strokeWidth={2} />
            <circle cx={x(hoverT)} cy={y(inc.mean)} r={4.5} fill={INCOMPLETE} stroke="#0e1014" strokeWidth={2} />
          </g>
        )}
      </svg>
    </div>
  )
}

/** Pre-work fig 05: the last second before release. */
export function ControlTimeline({ d }: { d: ControlData }) {
  const { ref, shown } = useReveal()
  return (
    <div ref={ref} className="flex flex-col gap-3">
      <div className="grid gap-4 md:grid-cols-3">
        <SmallTimeline rows={d.timeline.cpc} label="Control of landing spot" fmt={(v) => v.toFixed(2)} shown={shown} index={0} />
        <SmallTimeline rows={d.timeline.separation} label="Separation (yd)" fmt={(v) => v.toFixed(1)} shown={shown} index={1} />
        <SmallTimeline rows={d.timeline.territory} label="Receiver's own space (yd²)" fmt={(v) => v.toFixed(1)} shown={shown} index={2} />
      </div>
      <Legend items={[["Complete", COMPLETE], ["Incomplete / INT", INCOMPLETE]]} />
      <p className="text-xs text-zinc-400">Shaded bands show the range we are 95% confident in. Hover a chart to read both lines at that moment.</p>
    </div>
  )
}

/** Pre-work fig 08, regrouped so every populated cell has a usable sample. */
export function LeverageGrid({ d }: { d: ControlData }) {
  const { ref, shown } = useReveal()
  const { box, bind, node, active } = useTooltip()
  const { rows, cols, cells } = d.leverage
  const MIN_N = 25
  return (
    <div ref={ref} className="flex flex-col gap-3">
      <div ref={box} className="relative grid grid-cols-[64px_repeat(4,minmax(0,1fr))] gap-1">
        {[...rows].reverse().map((r, ri) => (
          <div key={r} className="contents">
            <span className="flex items-center text-xs text-zinc-400 tabular-nums">{r} yd</span>
            {cols.map((c, ci2) => {
              const cell = cells.find((x) => x.sep === r && x.lev === c)
              const small = cell && cell.n < MIN_N
              const key = `${r}-${c}`
              const color = cell ? rateColor(cell.rate, d.base_rate) : undefined
              return (
                <div
                  key={c}
                  {...(cell
                    ? bind(key, {
                        title: `${r} yards apart · ${c.toLowerCase()}`,
                        color,
                        rows: [
                          ["Caught", pct(cell.rate)],
                          ["Likely range", ci(cell.lo, cell.hi)],
                          ["Throws", cell.n.toLocaleString()],
                          ...(small ? ([["Note", "too few plays to trust"]] as [string, string][]) : []),
                        ],
                      })
                    : {})}
                  className={cn(
                    "flex h-16 cursor-default flex-col items-center justify-center rounded-sm",
                    cell && !small ? "text-white hover:ring-2 hover:ring-white/60" : "border border-dashed border-white/10 text-zinc-600"
                  )}
                  style={{
                    ...ease(ci2 + ri * 2, 500, "opacity, transform"),
                    background: cell && !small ? color : undefined,
                    opacity: shown ? dim(active, key) : 0,
                    transform: shown ? "none" : "scale(0.85)",
                  }}
                >
                  {cell && !small ? (
                    <>
                      <span className="text-sm font-medium tabular-nums">{pct(cell.rate)}</span>
                      <span className="text-[10px] opacity-75 tabular-nums">n={cell.n}</span>
                    </>
                  ) : (
                    <span className="text-[10px]">{cell ? `n=${cell.n}` : "—"}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        <span className="text-[10px] text-zinc-500">Separation</span>
        {cols.map((c) => (
          <span key={c} className="pt-1 text-center text-[11px] leading-tight text-zinc-400">
            {c}
          </span>
        ))}
        {node}
      </div>
      <RateScale base={d.base_rate} />
      <p className="text-xs text-zinc-400">
        Rows: how far the closest defender was from the receiver. Dashed boxes have too few plays to trust; — means it never happens.
      </p>
    </div>
  )
}

function CoesBars({
  rows,
  title,
  note,
  shown,
}: {
  rows: (MeanCI & { label: string; air_yards?: number })[]
  title: string
  note?: (r: { air_yards?: number }) => string
  shown: boolean
}) {
  const { box, bind, node, active } = useTooltip()
  const W = 520
  const H = 240
  const L = 52
  const lo = Math.min(0, ...rows.map((r) => r.lo)) * 1.15
  const hi = Math.max(0, ...rows.map((r) => r.hi)) * 1.15 || 0.01
  const y = (v: number) => 10 + ((hi - v) / (hi - lo)) * (H - 50)
  const bw = (W - L - 10) / rows.length
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-zinc-300">{title}</span>
      <div ref={box} className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
          {[lo, 0, hi].filter((v) => v === 0 || Math.abs(v) > (hi - lo) * 0.12).map((v) => (
            <text key={v} x={L - 5} y={y(v) + 3} textAnchor="end" className="fill-zinc-500 text-[9px]">{v.toFixed(3)}</text>
          ))}
          <line x1={L} x2={W - 10} y1={y(0)} y2={y(0)} stroke="#e4e4e7" opacity={0.5} />
          {rows.map((r, i) => {
            const cx = L + bw * i + bw / 2
            const color = r.mean >= 0 ? COMPLETE : INCOMPLETE
            return (
              <g
                key={r.label}
                className="cursor-default"
                style={{ opacity: dim(active, r.label), transition: "opacity 150ms" }}
                {...bind(r.label, {
                  title,
                  color,
                  rows: [
                    ["Group", r.label],
                    ["Control vs expected", `${r.mean >= 0 ? "+" : ""}${r.mean.toFixed(3)}`],
                    ["Likely range", `${r.lo.toFixed(3)} to ${r.hi.toFixed(3)}`],
                    ["Throws", r.n.toLocaleString()],
                    ...(r.air_yards != null ? ([["Median air yards", r.air_yards.toFixed(1)]] as [string, string][]) : []),
                  ],
                })}
              >
                <rect x={cx - bw * 0.45} width={bw * 0.9} y={8} height={H - 40} fill="transparent" />
                <rect
                  x={cx - bw * 0.3}
                  width={bw * 0.6}
                  y={Math.min(y(r.mean), y(0))}
                  height={Math.abs(y(r.mean) - y(0))}
                  rx={3}
                  fill={color}
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: r.mean >= 0 ? "bottom" : "top",
                    transform: shown ? "scaleY(1)" : "scaleY(0)",
                    transition: `transform 800ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 90}ms`,
                  }}
                />
                <line
                  x1={cx}
                  x2={cx}
                  y1={y(r.hi)}
                  y2={y(r.lo)}
                  stroke="#e4e4e7"
                  strokeWidth={1.2}
                  style={{ opacity: shown ? 1 : 0, transition: `opacity 300ms ${700 + i * 90}ms` }}
                />
                <text x={cx} y={H - 26} textAnchor="middle" className="fill-zinc-400 text-[9px]">{r.label}</text>
                {note && <text x={cx} y={H - 12} textAnchor="middle" className="fill-zinc-600 text-[9px]">{note(r)}</text>}
              </g>
            )
          })}
        </svg>
        {node}
      </div>
    </div>
  )
}

/** Pre-work fig 10: hypotheses tested, with the speed/depth confound shown on the chart. */
export function Hypotheses({ d }: { d: ControlData }) {
  const { ref, shown } = useReveal()
  return (
    <div ref={ref} className="flex flex-col gap-3">
      <div className="grid gap-4 md:grid-cols-2">
        <CoesBars rows={d.hypotheses.speed} title="Receiver speed when the ball is thrown (mph)" note={(r) => `${r.air_yards} air yd`} shown={shown} />
        <CoesBars rows={d.hypotheses.hips} title="Which way the closest defender's hips face" shown={shown} />
      </div>
      <p className="text-xs leading-relaxed text-zinc-400">
        Faster receivers look worse, but they are also running deeper routes (typical throw distance under each bar), so speed itself isn&apos;t the
        cause. The defender&apos;s hip direction made only a tiny difference, so we left it out of the model.
      </p>
    </div>
  )
}
