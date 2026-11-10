"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/** nfl_id -> NFL image id, from backend/scripts/export_headshots.py (nflverse rosters). */
let cache: Record<string, string> | null = null
let pending: Promise<Record<string, string>> | null = null

function loadHeadshots() {
  if (cache) return Promise.resolve(cache)
  pending ??= fetch("/data/headshots.json")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((m: Record<string, string>) => (cache = m))
  return pending
}

export function useHeadshots() {
  const [map, setMap] = useState<Record<string, string> | null>(cache)
  useEffect(() => {
    if (!cache) loadHeadshots().then(setMap)
  }, [])
  return map
}

/** Face-cropped thumbnail from the NFL image CDN (2× the display size for sharp retina rendering). */
export const faceUrl = (imageId: string, size: number) =>
  `https://static.www.nfl.com/image/private/c_thumb,g_face,w_${size * 2},h_${size * 2},f_auto,q_auto/league/${imageId}`

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

/** Round player headshot with a colored ring; falls back to initials when no photo is available. */
export function PlayerFace({
  id,
  name,
  size = 32,
  ring,
  className,
}: {
  id: number
  name: string
  size?: number
  ring?: string
  className?: string
}) {
  const map = useHeadshots()
  const [failed, setFailed] = useState(false)
  const imageId = map?.[String(id)]
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-zinc-300", className)}
      style={{ width: size, height: size, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined, fontSize: size * 0.36 }}
      title={name}
    >
      {imageId && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- external CDN thumbnails; next/image would need remotePatterns config
        <img src={faceUrl(imageId, size)} alt={name} width={size} height={size} loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <span className="font-medium">{initials(name)}</span>
      )}
    </span>
  )
}
