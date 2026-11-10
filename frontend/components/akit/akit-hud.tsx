"use client"

import { CircleHelp } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DEFENSE_COLOR, DOMINANCE_COLOR, OFFENSE_COLOR, spaceChange, type AkitMeta } from "@/lib/akit"
import { PlayerFace } from "./player-face"

/** Plain-language definitions shown in tooltips and in the key under the plays. */
export const DEFINITIONS = {
  space: {
    title: "Open space",
    body: "Square yards around the receiver that he controls better than any defender, based on where everyone is, how fast they move and which way they face. Appears once the ball is thrown. More space = easier catch.",
  },
  change: {
    title: "Space change",
    body: "How much the receiver's open space grew or shrank in the half-second after the throw. +11% means he gained 11% more room. In the analysis this is SICE (1.11 = +11%).",
  },
  defender: {
    title: "Nearest defender",
    body: "Distance from the receiver to the closest defender at this moment of the replay.",
  },
  rank: {
    title: "Space rank",
    body: "Where the targeted receiver ranked among all his teammates running routes, by open space at the throw. #1 means the QB threw to the most open receiver.",
  },
} as const

function Info({ def }: { def: { title: string; body: string } }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`What is ${def.title}?`} className="text-zinc-500 transition-colors hover:text-zinc-200">
          <Info12 />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-xs leading-relaxed">
        <span className="font-medium">{def.title}.</span> {def.body}
      </TooltipContent>
    </Tooltip>
  )
}

const Info12 = () => <CircleHelp className="size-3" />

/** Broadcast lower third for the targeted receiver: live open space, space change, nearest defender. */
export function AkitLowerThird({ m, dsv, nearest, phase }: { m: AkitMeta; dsv: number | null; nearest: number | null; phase: string }) {
  const change = spaceChange(m.sice)
  const stat = (
    def: { title: string; body: string },
    value: string,
    unit: string,
    sub: React.ReactNode,
    hide = ""
  ) => (
    <div className={`flex min-w-28 flex-col justify-center border-l border-white/10 px-4 py-2 ${hide}`}>
      <span className="flex items-center gap-1 text-[11px] text-zinc-400">
        {def.title} <Info def={def} />
      </span>
      <span className="mt-0.5 font-display text-2xl leading-none font-medium text-zinc-50 tabular-nums">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-zinc-500">{unit}</span>}
      </span>
      <span className="mt-1 text-[10px] leading-none text-zinc-500">{sub}</span>
    </div>
  )
  return (
    <div className="flex items-stretch overflow-hidden rounded-md border border-white/10 bg-[#0e1014]/90 backdrop-blur">
      <span className="w-1" style={{ background: DOMINANCE_COLOR }} />
      <div className="flex items-center pl-3">
        <PlayerFace id={m.nfl_id} name={m.display_name} size={44} ring={DOMINANCE_COLOR} />
      </div>
      <div className="flex flex-col justify-center px-4 py-2.5">
        <span className="text-base leading-tight font-medium text-zinc-50">{m.display_name}</span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
          {m.nfl_position} · {m.possession_team} · <span className="capitalize">{(m.route_ran ?? "route").toLowerCase()}</span> · #{m.dsv_rank} of{" "}
          {m.n_options} most open <Info def={DEFINITIONS.rank} />
        </span>
      </div>
      {stat(DEFINITIONS.space, dsv == null ? "—" : dsv.toFixed(1), "yd²", <span className="text-amber-300">{phase}</span>)}
      {stat(
        DEFINITIONS.change,
        change.label,
        "",
        <span className={change.gained ? "text-teal-300" : "text-orange-300"}>{change.text}</span>,
        "hidden sm:flex"
      )}
      {stat(DEFINITIONS.defender, nearest == null ? "—" : nearest.toFixed(1), "yd", "right now", "hidden md:flex")}
    </div>
  )
}

/** DSV through the pass flight, with a playhead. */
export function FlightChart({ m, frame, className = "" }: { m: AkitMeta; frame: number; className?: string }) {
  const W = 260
  const H = 92
  const s = m.dsv_series
  const max = 34
  const x = (i: number) => 8 + (i / Math.max(1, s.length - 1)) * (W - 16)
  const y = (v: number) => H - 18 - (v / max) * (H - 30)
  const line = s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const k = frame - m.release_frame
  const inFlight = k >= 0 && k < s.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Dominated spatial volume from the throw to 0.5 s after">
      {[10, 20, 30].map((v) => (
        <g key={v}>
          <line x1={8} x2={W - 8} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" />
          <text x={W - 8} y={y(v) - 2} textAnchor="end" className="fill-zinc-600 tabular-nums text-[8px]">{v}</text>
        </g>
      ))}
      <path d={`${line} L${x(s.length - 1)},${H - 18} L${x(0)},${H - 18} Z`} fill={DOMINANCE_COLOR} opacity={0.14} />
      <path d={line} fill="none" stroke={DOMINANCE_COLOR} strokeWidth={2} strokeLinejoin="round" />
      <text x={x(0)} y={H - 5} className="fill-zinc-500 tabular-nums text-[8px]">Throw</text>
      <text x={x(s.length - 1)} y={H - 5} textAnchor="end" className="fill-zinc-500 tabular-nums text-[8px]">+0.5 s</text>
      {inFlight && (
        <>
          <line x1={x(k)} x2={x(k)} y1={6} y2={H - 18} stroke="#fafafa" strokeWidth={1.2} />
          <circle cx={x(k)} cy={y(s[k])} r={3.5} fill="#fafafa" />
        </>
      )}
    </svg>
  )
}

export function FieldLegend() {
  return (
    <div className="flex flex-col gap-1 text-[10px] text-zinc-400">
      <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm" style={{ background: DOMINANCE_COLOR, opacity: 0.8 }} /> receiver-owned space (vs all nearby defenders)</span>
      <span className="flex items-center gap-2"><i className="h-2.5 w-4 rounded-full border-2" style={{ borderColor: DEFENSE_COLOR }} /> influence ellipse (τ = 0.1)</span>
      <span className="flex items-center gap-2">
        <i className="size-2.5 rounded-full" style={{ background: DOMINANCE_COLOR }} /> target ·
        <i className="size-2.5 rounded-full" style={{ background: OFFENSE_COLOR }} /> QB ·
        <i className="size-2.5 rounded-full" style={{ background: DEFENSE_COLOR }} /> closest defender
      </span>
    </div>
  )
}
