"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

/** Draws a rounded pill label onto a canvas; returns the canvas + its aspect ratio. */
function drawLabel(canvas: HTMLCanvasElement, lines: string[], bg: string, fg: string) {
  const g = canvas.getContext("2d")!
  const fs = 40
  // Match the page font (next/font registers a hashed family name on <body>).
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif"
  g.font = `500 ${fs}px ${family}`
  const w = Math.ceil(Math.max(...lines.map((l) => g.measureText(l).width)) + 36)
  const h = Math.ceil(lines.length * fs * 1.25 + 20)
  canvas.width = w
  canvas.height = h
  g.font = `500 ${fs}px ${family}`
  g.fillStyle = bg
  g.beginPath()
  g.roundRect(0, 0, w, h, 14)
  g.fill()
  g.textAlign = "center"
  g.textBaseline = "middle"
  lines.forEach((l, i) => {
    g.fillStyle = i === 0 ? fg : "#67e8f9"
    g.fillText(l, w / 2, 10 + fs * 1.25 * (i + 0.5))
  })
  return w / h
}

interface Props {
  lines: string[]
  position?: [number, number, number]
  bg?: string
  fg?: string
  /** World height of the label in yards. */
  height?: number
}

/** Camera-facing text label rendered as a sprite (no DOM, safe to mount/unmount). */
export function LabelSprite({ lines, position = [0, 0, 0], bg = "rgba(0,0,0,0.75)", fg = "#ffffff", height = 0.9 }: Props) {
  const sprite = useRef<THREE.Sprite>(null)
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement("canvas")
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return { canvas, tex }
  }, [])
  const key = lines.join("\n")
  useEffect(() => {
    const aspect = drawLabel(canvas, key.split("\n"), bg, fg)
    tex.needsUpdate = true
    sprite.current?.scale.set(height * aspect, height, 1)
  }, [canvas, tex, key, bg, fg, height])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <sprite ref={sprite} position={position} renderOrder={10}>
      <spriteMaterial map={tex} depthTest={false} transparent toneMapped={false} />
    </sprite>
  )
}
