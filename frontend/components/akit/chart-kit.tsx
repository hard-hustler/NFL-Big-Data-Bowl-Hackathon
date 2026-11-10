"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"

/** True once the element has scrolled into view (immediately when the user prefers reduced motion). */
export function useReveal<T extends Element = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, shown }
}

/** Staggered CSS transition for entry animations. */
export const ease = (i = 0, ms = 700, props = "all"): CSSProperties => ({
  transition: `${props} ${ms}ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 70}ms`,
})

export interface TipContent {
  title: string
  rows: [string, string][]
  color?: string
}

/**
 * Floating tooltip that follows the cursor inside a `relative` container.
 * Spread `bind(key, content)` onto any mark; `active` is the hovered key for dimming the rest.
 */
export function useTooltip() {
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number; key: string; content: TipContent } | null>(null)
  const move = useCallback((e: React.MouseEvent, key: string, content: TipContent) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, key, content })
  }, [])
  const bind = (key: string, content: TipContent) => ({
    onMouseEnter: (e: React.MouseEvent) => move(e, key, content),
    onMouseMove: (e: React.MouseEvent) => move(e, key, content),
    onMouseLeave: () => setTip(null),
  })
  const flip = tip && box.current ? tip.x > box.current.clientWidth - 180 : false
  const node: ReactNode = tip ? (
    <div
      className="pointer-events-none absolute z-30 min-w-40 rounded-md border border-white/10 bg-[#16181d]/95 px-3 py-2 shadow-xl shadow-black/50 backdrop-blur"
      style={{ left: tip.x, top: tip.y, transform: `translate(${flip ? "calc(-100% - 14px)" : "14px"}, calc(-100% - 10px))` }}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-50">
        {tip.content.color && <i className="size-2.5 rounded-full" style={{ background: tip.content.color }} />}
        {tip.content.title}
      </div>
      <dl className="mt-1.5 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-[11px]">
        {tip.content.rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-zinc-500">{k}</dt>
            <dd className="text-right text-zinc-200 tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  ) : null
  return { box, bind, node, active: tip?.key ?? null }
}

/** Opacity for a mark given the hovered key: the hovered one stays full, the rest dim. */
export const dim = (active: string | null, key: string, base = 1) => (active && active !== key ? base * 0.35 : base)
