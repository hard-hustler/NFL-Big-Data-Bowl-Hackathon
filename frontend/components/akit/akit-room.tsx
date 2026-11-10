"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Camera, Crosshair, Grid2x2, Layers, Orbit, PanelRight, Repeat, Tv } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DEFENSE_COLOR,
  DOMINANCE_COLOR,
  dominance,
  OFFENSE_COLOR,
  spaceChange,
  fieldOf,
  getAkitLeaders,
  getAkitPlay,
  getAkitPlays,
  getAkitReceivers,
  getAkitSummary,
  stateAt,
  type AkitDetail,
  type AkitLeader,
  type AkitPlayRow,
  type AkitReceiver,
  type AkitSummary,
} from "@/lib/akit"
import type { AkitCamera } from "@/components/replay/akit-scene"
import { opponentOf, ord, ScoreBug, Transport } from "./broadcast-hud"
import { AkitFilmstrip } from "./akit-filmstrip"
import { PlayerFace } from "./player-face"
import { ReceiverPicker } from "./receiver-picker"
import { AkitLowerThird, FieldLegend, FlightChart, NumbersKey } from "./akit-hud"
import { getControlData, type ControlData } from "@/lib/control"
import { ControlTimeline, Hypotheses, LeverageGrid, SameSeparation, SeparationVsControl } from "./control-charts"
import { akitHeadline, AkitLeaderboard, AucChart, CatchByDsv, PositionTable, QbDecision, SiceSplit } from "./akit-insights"

const AkitScene = dynamic(() => import("@/components/replay/akit-scene"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none bg-zinc-900" />,
})

const CAMERAS: { value: AkitCamera; label: string; icon: typeof Tv }[] = [
  { value: "broadcast", label: "Broadcast", icon: Tv },
  { value: "overhead", label: "Overhead (space map)", icon: Grid2x2 },
  { value: "all22", label: "All-22", icon: Camera },
  { value: "follow", label: "Follow receiver", icon: Crosshair },
  { value: "orbit", label: "Free orbit", icon: Orbit },
]

function Panel({
  eyebrow,
  title,
  hint,
  children,
  className = "",
}: {
  eyebrow: string
  title: string
  /** One plain-language sentence on how to read the chart. */
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-lg border border-white/[0.08] bg-[#0e1014] p-6 ${className}`}>
      <p className="text-xs font-medium text-zinc-500">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-medium text-zinc-50">{title}</h2>
      {hint ? <p className="mt-1 mb-6 max-w-2xl text-sm leading-relaxed text-zinc-400">{hint}</p> : <div className="mb-6" />}
      {children}
    </section>
  )
}

const RESULT: Record<string, string> = { C: "Complete", I: "Incomplete", IN: "Intercepted" }

export function AkitRoom() {
  const [summary, setSummary] = useState<AkitSummary | null>(null)
  const [control, setControl] = useState<ControlData | null>(null)
  const [leaders, setLeaders] = useState<{ league_dsv: number; rows: AkitLeader[] } | null>(null)
  const [receivers, setReceivers] = useState<AkitReceiver[]>([])
  const [receiverId, setReceiverId] = useState<number | null>(null)
  const [contestedOnly, setContestedOnly] = useState(false)
  const [plays, setPlays] = useState<AkitPlayRow[]>([])
  const [total, setTotal] = useState(0)
  const [current, setCurrent] = useState<AkitPlayRow | null>(null)
  const [detail, setDetail] = useState<AkitDetail | null>(null)
  const [inspector, setInspector] = useState(false)
  const [showFields, setShowFields] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const timeRef = useRef(0)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(0.5)
  const [autoplay, setAutoplay] = useState(true)
  const [ended, setEnded] = useState(false)
  const [camera, setCamera] = useState<AkitCamera>("broadcast")
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([getAkitSummary(), getAkitReceivers(), getAkitLeaders()])
      .then(([s, r, l]) => {
        setSummary(s)
        setReceivers(r)
        setLeaders(l)
        setReceiverId(r[0]?.nfl_id ?? null)
      })
      .catch((e) => setError(`Data not found (${e.message}). Run backend/scripts/export_static.py.`))
  }, [])

  useEffect(() => {
    getControlData().then(setControl).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (receiverId == null) return
    getAkitPlays(receiverId, contestedOnly)
      .then((r) => {
        setPlays(r.plays)
        setTotal(r.total)
        setCurrent(r.plays[0] ?? null)
      })
      .catch((e) => setError(e.message))
  }, [receiverId, contestedOnly])

  useEffect(() => {
    if (!current) {
      setDetail(null)
      return
    }
    setPlaying(false)
    setEnded(false)
    getAkitPlay(current)
      .then((d) => {
        timeRef.current = 0
        setFrame(0)
        setDetail(d)
        setPlaying(true)
      })
      .catch((e) => setError(e.message))
  }, [current])

  const seek = useCallback((f: number) => {
    setPlaying(false)
    setEnded(false)
    timeRef.current = f
    setFrame(f)
  }, [])
  const onEnd = useCallback(() => {
    setPlaying(false)
    setEnded(true)
  }, [])

  // Autoplay: after a play finishes, pause briefly, then load the next card (wrapping to the first).
  useEffect(() => {
    if (!ended || !autoplay || plays.length < 2 || !current) return
    const t = setTimeout(() => {
      const i = plays.findIndex((p) => p.game_id === current.game_id && p.play_id === current.play_id)
      setCurrent(plays[(i + 1) % plays.length])
    }, 1000)
    return () => clearTimeout(t)
  }, [ended, autoplay, plays, current])

  const m = detail?.meta
  const n = detail?.players[0].frames.length ?? 1

  // Live DSV + nearest tracked defender at the current integer frame (same math as the backend).
  const live = useMemo(() => {
    if (!detail || !m) return { dsv: null, nearest: null }
    const rec = detail.players.find((p) => p.targeted)!
    const defs = detail.players.filter((p) => p.side === "defense")
    const r = stateAt(rec.frames, frame)
    const ds = defs.map((d) => stateAt(d.frames, frame))
    const nearest = ds.length ? Math.min(...ds.map((d) => Math.hypot(d.x - r.x, d.y - r.y))) : null
    const dsv = frame >= m.release_frame ? dominance(fieldOf(r), ds.map(fieldOf), m.land_x, m.land_y) : null
    return { dsv, nearest }
  }, [detail, m, frame])

  const phase = useMemo(() => {
    if (!m) return ""
    if (frame < m.snap_frame) return "Pre-snap"
    if (frame < m.release_frame) return "Dropback"
    return "Ball out"
  }, [m, frame])

  const selectReceiver = (id: number) => {
    setReceiverId(id)
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <TooltipProvider>
      <div className="app-zoom min-h-screen bg-[#0a0b0e] text-zinc-100">
        <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0a0b0e]/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 md:px-6">
            <div className="flex items-baseline gap-3">
              <span className="text-[15px] font-medium tracking-tight text-zinc-50">AirSpace</span>
              <span className="hidden text-xs text-zinc-500 sm:inline">NFL Big Data Bowl · 2021 season</span>
            </div>
            <nav className="ml-6 hidden items-center gap-6 text-[13px] text-zinc-400 md:flex">
              <a href="#film" className="hover:text-white">Film room</a>
              <a href="#finding" className="hover:text-white">The finding</a>
              <a href="#control" className="hover:text-white">Catch-point control</a>
              <a href="#method" className="hover:text-white">Method</a>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <ReceiverPicker receivers={receivers} value={receiverId} onChange={setReceiverId} />
            </div>
          </div>
        </header>

        <main className="mx-auto flex max-w-[1600px] flex-col gap-10 px-4 py-10 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-end">
            <div>
              <p className="text-sm text-zinc-500">Anisotropic kinematic influence · every WR, TE and RB target, 2021 weeks 1–8</p>
              <h1 className="mt-3 max-w-3xl text-3xl leading-tight font-medium tracking-tight text-zinc-50 md:text-[40px]">
                When the quarterback lets it go, does the receiver’s space help or hurt?
              </h1>
            </div>
            <div className="border-l border-white/15 pl-5 text-[15px] leading-relaxed text-zinc-400">
              {summary ? akitHeadline(summary) : <Skeleton className="h-20 w-full" />}
            </div>
          </div>

          {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

          <section id="film" ref={stageRef} className="scroll-mt-20">
            <div className="relative h-[66vh] min-h-[480px] overflow-hidden rounded-lg border border-white/[0.08] bg-black">
              {detail ? (
                <AkitScene
                  play={detail}
                  timeRef={timeRef}
                  playing={playing}
                  speed={speed}
                  camera={camera}
                  showFields={showFields}
                  onFrame={setFrame}
                  onEnd={onEnd}
                />
              ) : (
                <Skeleton className="h-full w-full rounded-none bg-zinc-900" />
              )}

              {m && detail && (
                <>
                  <div className="absolute top-4 left-4">
                    <ScoreBug m={m} />
                  </div>
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <div className="flex rounded-lg border border-white/10 bg-zinc-950/80 p-1 backdrop-blur">
                      {CAMERAS.map(({ value, label, icon: Icon }) => (
                        <Tooltip key={value}>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={label}
                              onClick={() => setCamera(value)}
                              className={`size-8 ${camera === value ? "bg-white/15 text-white" : "text-zinc-400"}`}
                            >
                              <Icon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{label}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Toggle
                          pressed={showFields}
                          onPressedChange={setShowFields}
                          aria-label="Influence fields"
                          className="h-10 border border-white/10 bg-zinc-950/80 backdrop-blur data-[state=on]:bg-teal-400/20 data-[state=on]:text-teal-200"
                        >
                          <Layers className="size-4" />
                        </Toggle>
                      </TooltipTrigger>
                      <TooltipContent>Influence fields &amp; space map</TooltipContent>
                    </Tooltip>
                    <Button size="sm" variant="secondary" className="h-10 gap-2 border border-white/10 bg-zinc-950/80 backdrop-blur" onClick={() => setInspector(true)}>
                      <PanelRight className="size-4" /> Inspector
                    </Button>
                  </div>
                  <div className="absolute right-4 bottom-[84px] left-4 flex items-end justify-between gap-4">
                    <AkitLowerThird m={m} dsv={live.dsv} nearest={live.nearest} phase={phase} />
                    <div className="hidden flex-col gap-2 rounded-md border border-white/10 bg-[#0e1014]/90 p-3 backdrop-blur lg:flex">
                      <span className="text-xs font-medium text-zinc-400">Open space after the throw (yd²)</span>
                      <FlightChart m={m} frame={frame} className="w-[240px]" />
                      <FieldLegend />
                    </div>
                  </div>
                  <div className="absolute right-4 bottom-4 left-4">
                    <Transport
                      length={n}
                      snapFrame={m.snap_frame}
                      events={detail.events}
                      frame={frame}
                      playing={playing}
                      speed={speed}
                      onToggle={() => {
                        setEnded(false)
                        if (frame >= n - 1) {
                          timeRef.current = 0
                          setFrame(0)
                        }
                        setPlaying((p) => !p)
                      }}
                      onRestart={() => {
                        setEnded(false)
                        timeRef.current = 0
                        setFrame(0)
                        setPlaying(true)
                      }}
                      onSeek={seek}
                      onSpeed={setSpeed}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <h2 className="flex items-center gap-2 text-base font-medium text-zinc-50">
                Plays for <ReceiverPicker receivers={receivers} value={receiverId} onChange={setReceiverId} compact />
              </h2>
              <span className="text-xs text-zinc-500">
                {total} targets{total > plays.length ? ` · showing ${plays.length}` : ""} · in game order
              </span>
              {ended && autoplay && plays.length > 1 && <span className="animate-pulse text-xs text-teal-300">Next play in a moment…</span>}
              <div className="ml-auto flex items-center gap-2">
                <Toggle
                  size="sm"
                  variant="outline"
                  pressed={autoplay}
                  onPressedChange={setAutoplay}
                  className="gap-1.5 px-3 text-xs data-[state=on]:border-teal-400/50 data-[state=on]:text-teal-200"
                  aria-label="Autoplay next play"
                >
                  <Repeat className="size-3.5" /> Autoplay {autoplay ? "on" : "off"}
                </Toggle>
                <Toggle size="sm" variant="outline" pressed={contestedOnly} onPressedChange={setContestedOnly} className="px-3 text-xs">
                  Tight coverage only (defender ≤ 2 yd)
                </Toggle>
              </div>
            </div>
            <div className="mt-3">
              <AkitFilmstrip plays={plays} current={current} onSelect={setCurrent} progress={n > 1 ? frame / (n - 1) : 0} />
            </div>
            <div className="mt-3">
              <NumbersKey />
            </div>
          </section>

          <div id="finding" className="grid scroll-mt-20 gap-6 xl:grid-cols-2">
            <Panel
              eyebrow="Finding 1 · Space at the throw"
              title="More open space when the ball is thrown = more catches"
              hint="We sorted every throw into four equal groups, from least to most open space around the receiver. Taller bar = more passes caught."
            >
              {summary ? <CatchByDsv s={summary} /> : <Skeleton className="h-72 w-full" />}
            </Panel>
            <Panel
              eyebrow="Finding 2 · Quarterback decisions"
              title="QBs often skip the most open receiver"
              hint="On each play we ranked every receiver by open space. Each bar shows how often the pass was caught, depending on which receiver the QB picked."
            >
              {summary ? <QbDecision s={summary} /> : <Skeleton className="h-72 w-full" />}
            </Panel>
            <Panel
              eyebrow="Finding 3 · After the throw"
              title="Space that opens after the throw barely helps"
              hint="Did the receiver gain or lose space in the half-second after the ball left? Either way, the catch rate is almost the same."
            >
              {summary ? <SiceSplit s={summary} /> : <Skeleton className="h-72 w-full" />}
            </Panel>
            <Panel
              eyebrow="Finding 4 · How good is the measure?"
              title="Does open space predict a catch?"
              hint="Each dot is a score from 0.5 (a coin flip) to 1 (always right) for telling catches from incompletions. Further right = better predictor."
            >
              {summary ? <AucChart s={summary} /> : <Skeleton className="h-72 w-full" />}
            </Panel>
            <Panel
              eyebrow="Leaderboard"
              title="Receivers who get the most open space"
              hint="Average open space when the ball is thrown to them. Click a name to watch his plays above."
            >
              {leaders && summary ? (
                <AkitLeaderboard
                  rows={leaders.rows}
                  league={leaders.league_dsv}
                  baseCatch={summary.base_catch}
                  selected={receiverId}
                  onSelect={selectReceiver}
                />
              ) : (
                <Skeleton className="h-72 w-full" />
              )}
            </Panel>
            <Panel
              eyebrow="Position groups"
              title="Running backs get the most space, wide receivers the least"
              hint="Open space is measured in square yards around the receiver. Catch rate is colored on the same scale as the charts."
            >
              {summary ? <PositionTable s={summary} /> : <Skeleton className="h-24 w-full" />}
            </Panel>
          </div>

          <section id="control" className="flex scroll-mt-20 flex-col gap-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-end">
              <div>
                <p className="text-sm text-zinc-500">Deep dive · catch-point control</p>
                <h2 className="mt-2 text-2xl leading-tight font-medium tracking-tight text-zinc-50 md:text-3xl">
                  Separation is a distance. Control is a field.
                </h2>
              </div>
              <p className="border-l border-white/15 pl-5 text-sm leading-relaxed text-zinc-400">
                Separation only measures the gap to the nearest defender. Catch-point control asks a better question: when the ball is thrown, who owns
                the spot where it will come down? 0.5 means a toss-up, 1 means the receiver owns it. Same 2021 data,{" "}
                {control ? `${control.n_plays.toLocaleString()} targets with a usable catch point` : "targets with a usable catch point"}.
              </p>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel
                eyebrow="Same separation, different outcome"
                title="Two receivers can be equally open and still have very different odds"
                hint="Each column is a range of separation. Inside each column, plays are split into three equal groups by how much the receiver controlled the landing spot. At 1–2 yards apart, the catch rate goes from 34% to 67%."
                className="xl:col-span-2"
              >
                {control ? <SameSeparation d={control} /> : <Skeleton className="h-72 w-full" />}
              </Panel>
              <Panel
                eyebrow="Control is not just distance"
                title="More separation usually means more control, but not always"
                hint="Each dot is one throw: teal was caught, orange was not. The background shows the catch rate in that area. Above the dashed line, the receiver owns the landing spot."
              >
                {control ? <SeparationVsControl d={control} /> : <Skeleton className="h-72 w-full" />}
              </Panel>
              <Panel
                eyebrow="Leverage"
                title="Being closer to the landing spot wins catches"
                hint="Columns show who was closer to where the ball would land. Even with the same separation, the receiver wins more often when he is closer."
              >
                {control ? <LeverageGrid d={control} /> : <Skeleton className="h-72 w-full" />}
              </Panel>
              <Panel
                eyebrow="Timing"
                title="Catches are won in the second before the throw"
                hint="Average values for passes that were caught (teal) and not caught (orange), from 1 second before the throw to just after. Control pulls apart before the ball is thrown; separation barely changes."
                className="xl:col-span-2"
              >
                {control ? <ControlTimeline d={control} /> : <Skeleton className="h-56 w-full" />}
              </Panel>
              <Panel
                eyebrow="Ideas we tested"
                title="Does a faster receiver or a turned defender change things?"
                hint="Bars above zero mean the receiver had more control than his separation alone would suggest; below zero, less."
                className="xl:col-span-2"
              >
                {control ? <Hypotheses d={control} /> : <Skeleton className="h-56 w-full" />}
              </Panel>
            </div>
          </section>

          <Panel eyebrow="Method" title="How it is measured" className="scroll-mt-20">
            <div id="method" className="grid gap-6 text-sm leading-relaxed text-zinc-400 md:grid-cols-3">
              <div>
                <h3 className="mb-1 font-medium text-zinc-200">Influence tensor</h3>
                Each player is an anisotropic Gaussian: centered 0.5 s ahead along the velocity vector, long axis along body orientation, σ²_long = σ₀² +
                0.1·s², σ²_lat = σ₀² / (1 + 0.05·s²), σ₀ = 1.5 yd. A 0.5 yd cell belongs to the receiver when his influence beats all 11 defenders and exceeds
                τ = 0.1.
              </div>
              <div>
                <h3 className="mb-1 font-medium text-zinc-200">DSV &amp; SICE</h3>
                DSV = receiver-owned area (yd²) in a 30×30 yd window centered on where he is 0.5 s after the throw, scored for every route runner. SICE =
                (DSV at +0.5 s + 1) / (DSV at the throw + 1).{" "}
                {summary ? `${summary.n_plays.toLocaleString()} targets and ${summary.n_options.toLocaleString()} receiver options across ${summary.n_games} games.` : ""}{" "}
                CIs are 95% bootstrap.
              </div>
              <div>
                <h3 className="mb-1 font-medium text-zinc-200">Limits</h3>
                NFL Big Data Bowl regional data: all 22 players and the ball, 2021 weeks 1–8. Tracking ends 0.5 s after the release, so the catch point is
                not observed. The target is parsed from the play-by-play text. The replay shows three players (QB, target, closest defender) and the ball; the
                teal space map is still computed against every defender within 12 yd. Ball height is illustrative.
              </div>
            </div>
          </Panel>
        </main>

        <Sheet open={inspector} onOpenChange={setInspector}>
          <SheetContent className="w-full gap-0 overflow-y-auto border-white/10 bg-zinc-950 sm:max-w-md">
            {m && detail && (
              <>
                <SheetHeader className="border-b border-white/10">
                  <SheetDescription className="text-xs">
                    {m.season} Week {m.week} · {m.possession_team} vs {opponentOf(m)}
                  </SheetDescription>
                  <SheetTitle className="text-lg font-medium">
                    {m.display_name} · {m.route_ran ?? "route"}
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-6 p-4">
                  <section className="grid grid-cols-3 gap-2">
                    {[
                      ["Open space at throw", `${m.dsv_release.toFixed(1)} yd²`],
                      ["Open space 0.5 s later", `${m.dsv_arrival.toFixed(1)} yd²`],
                      ["Space change", `${spaceChange(m.sice).label}`],
                      ["Separation", m.separation_at_pass_forward != null ? `${m.separation_at_pass_forward.toFixed(1)} yd` : "—"],
                      ["Result", RESULT[m.pass_result ?? ""] ?? "—"],
                      ["Yards", m.yards_gained != null ? `${m.yards_gained}` : "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                        <div className="text-[11px] text-zinc-500">{k}</div>
                        <div className="mt-1 text-lg font-medium text-zinc-100 tabular-nums">{v}</div>
                      </div>
                    ))}
                  </section>
                  <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-medium text-zinc-400">DSV through the flight</h3>
                    <FlightChart m={m} frame={frame} className="w-full" />
                  </section>
                  <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-medium text-zinc-400">In the scene</h3>
                    <ul className="flex flex-col divide-y divide-white/[0.05] text-sm">
                      {detail.players.filter((p) => p.role !== "ball" && p.role !== "option" && p.primary).map((p) => (
                        <li key={p.nfl_id} className="flex items-center justify-between py-1.5">
                          <span className="flex items-center gap-2.5 text-zinc-200">
                            <PlayerFace
                              id={p.nfl_id}
                              name={p.display_name}
                              size={30}
                              ring={p.role === "target" ? DOMINANCE_COLOR : p.side === "defense" ? DEFENSE_COLOR : OFFENSE_COLOR}
                            />
                            <span>
                              {p.display_name} <span className="text-xs text-zinc-500">{p.position}</span>
                            </span>
                          </span>
                          <span className={`text-[11px] ${p.role === "target" ? "text-teal-300" : p.side === "defense" ? "text-orange-400" : "text-blue-400"}`}>
                            {p.role === "option" ? "most space" : p.role}
                            {p.dsv_release != null ? ` · ${p.dsv_release.toFixed(0)} yd²` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-medium text-zinc-400">Context</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {[
                        ["Situation", `${ord(m.down)} & ${m.yards_to_go}, Q${m.quarter} ${m.game_clock}`],
                        ["Coverage", m.team_coverage_type ? m.team_coverage_type.replaceAll("_", " ").toLowerCase() : "—"],
                        ["Space rank", `#${m.dsv_rank} of ${m.n_options}`],
                        ["Most space", m.threw_to_best ? "This receiver" : `${m.best_name} (${m.best_dsv.toFixed(0)} yd²)`],
                        ["Nearest def @ throw", m.def_dist_release != null ? `${m.def_dist_release.toFixed(1)} yd` : "—"],
                        ["Nearest def @ +0.5 s", m.def_dist_arrival != null ? `${m.def_dist_arrival.toFixed(1)} yd` : "—"],
                      ].map(([k, v]) => (
                        <div key={k} className="flex flex-col">
                          <dt className="text-[11px] text-zinc-500">{k}</dt>
                          <dd className="text-zinc-200 capitalize">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-medium text-zinc-400">Play-by-play</h3>
                    <p className="rounded-md bg-white/[0.03] p-3 text-xs leading-relaxed text-zinc-400">{m.play_description}</p>
                  </section>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  )
}
