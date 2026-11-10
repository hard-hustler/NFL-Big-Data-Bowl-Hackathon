"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { DOMINANCE_COLOR, type AkitPlayRow } from "@/lib/akit"

const RESULT: Record<string, string> = { C: "Catch", I: "Incomplete", IN: "INT" }

function Spark({ s }: { s: number[] }) {
  const W = 200
  const H = 64
  const x = (i: number) => 6 + (i / Math.max(1, s.length - 1)) * (W - 12)
  const y = (v: number) => H - 8 - (v / 34) * (H - 16)
  const d = s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" aria-hidden>
      <line x1={6} x2={W - 6} y1={y(s[0])} y2={y(s[0])} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
      <path d={`${d} L${x(s.length - 1)},${H - 8} L${x(0)},${H - 8} Z`} fill={DOMINANCE_COLOR} opacity={0.12} />
      <path d={d} fill="none" stroke={DOMINANCE_COLOR} strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={x(0)} cy={y(s[0])} r={3} fill="#09090b" stroke={DOMINANCE_COLOR} strokeWidth={2} />
      <circle cx={x(s.length - 1)} cy={y(s[s.length - 1])} r={3.5} fill={DOMINANCE_COLOR} />
    </svg>
  )
}

export function AkitFilmstrip({
  plays,
  current,
  onSelect,
  progress = 0,
}: {
  plays: AkitPlayRow[]
  current: AkitPlayRow | null
  onSelect: (p: AkitPlayRow) => void
  /** 0–1 playback progress of the active play, drawn along the bottom of its card. */
  progress?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const activeKey = current ? `${current.game_id}-${current.play_id}` : ""
  useEffect(() => {
    // Scroll only the strip sideways (scrollIntoView would also yank the page while autoplay advances).
    const strip = ref.current
    const card = strip?.querySelector<HTMLElement>(`[data-key="${activeKey}"]`)
    if (!strip || !card) return
    const left = card.offsetLeft - strip.offsetLeft
    if (left < strip.scrollLeft || left + card.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: Math.max(0, left - 12), behavior: "smooth" })
    }
  }, [activeKey])

  return (
    <div ref={ref} className="flex snap-x gap-3 overflow-x-auto pb-3 [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin]">
      {plays.map((p) => {
        const key = `${p.game_id}-${p.play_id}`
        const active = key === activeKey
        const result = p.pass_result === "C" ? `+${p.yards_gained ?? 0} yd` : RESULT[p.pass_result ?? ""] ?? "—"
        return (
          <button
            key={key}
            data-key={key}
            type="button"
            onClick={() => onSelect(p)}
            className={cn(
              "flex w-[208px] shrink-0 snap-start flex-col overflow-hidden rounded-md border bg-[#0e1014] text-left transition-all hover:border-white/20",
              "relative",
              active ? "border-teal-400/70" : "border-white/[0.08]"
            )}
          >
            {active && (
              <span className="absolute inset-x-0 bottom-0 z-10 h-0.5 bg-white/10">
                <span className="block h-full bg-teal-400 transition-[width] duration-100 ease-linear" style={{ width: `${Math.round(progress * 100)}%` }} />
              </span>
            )}
            <div className="relative bg-white/[0.02] px-1 pt-6">
              <Spark s={p.dsv_series} />
              <span
                className={cn(
                  "absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-medium",
                  p.sice > 1 ? "bg-teal-300 text-black" : "bg-zinc-700 text-zinc-100"
                )}
              >
                SICE {p.sice.toFixed(2)}
              </span>
              <span
                className={cn(
                  "absolute top-2 right-2 rounded px-1.5 py-0.5 text-[10px]",
                  p.threw_to_best ? "bg-teal-300/90 text-black" : "bg-black/50 text-zinc-300"
                )}
                title={p.threw_to_best ? "Thrown to the receiver with the most space" : `Most space: ${p.best_name}`}
              >
                {p.threw_to_best ? "Most open" : `#${p.dsv_rank} of ${p.n_options}`}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm leading-none font-medium text-zinc-50 capitalize">{(p.route_ran ?? "Route").toLowerCase()}</span>
                <span className={cn("tabular-nums text-xs font-semibold", p.pass_result === "C" ? "text-zinc-100" : "text-zinc-400")}>{result}</span>
              </div>
              <div className="flex items-center justify-between tabular-nums text-[10px] text-zinc-500">
                <span>
                  {p.season} W{p.week} · {p.down}&{p.yards_to_go}
                </span>
                <span className="text-zinc-300">
                  {p.dsv_release.toFixed(0)}→{p.dsv_arrival.toFixed(0)} yd²
                </span>
              </div>
            </div>
          </button>
        )
      })}
      {plays.length === 0 && <p className="py-8 text-sm text-zinc-500">No plays match these filters.</p>}
    </div>
  )
}
