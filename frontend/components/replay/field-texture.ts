import * as THREE from "three"

/** Field units are yards: x 0-120 (end zones 0-10, 110-120), y 0-53.3. */
export const FIELD_W = 120
export const FIELD_H = 160 / 3
const PX = 20 // pixels per yard

/**
 * Paints a regulation field onto a canvas: 5-yd mowing stripes, yard lines,
 * hash marks, yard numbers and team-tinted end zones. Canvas y == field y.
 */
export function makeFieldTexture(leftTeam: string, leftColor: string, rightTeam: string, rightColor: string) {
  const c = document.createElement("canvas")
  c.width = FIELD_W * PX
  c.height = Math.round(FIELD_H * PX)
  const g = c.getContext("2d")!
  const H = c.height

  // Turf with mowing stripes
  for (let x = 10; x < 110; x += 5) {
    g.fillStyle = (x / 5) % 2 === 0 ? "#2f6b2f" : "#2a6129"
    g.fillRect(x * PX, 0, 5 * PX, H)
  }

  // End zones
  const endZone = (x0: number, color: string, label: string, rot: number) => {
    g.fillStyle = color
    g.fillRect(x0 * PX, 0, 10 * PX, H)
    g.fillStyle = "rgba(0,0,0,0.25)"
    g.fillRect(x0 * PX, 0, 10 * PX, H)
    g.save()
    g.translate((x0 + 5) * PX, H / 2)
    g.rotate(rot)
    g.fillStyle = "rgba(255,255,255,0.92)"
    g.font = `900 ${6.5 * PX}px system-ui, sans-serif`
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.fillText(label, 0, 0)
    g.restore()
  }
  endZone(0, leftColor, leftTeam, -Math.PI / 2)
  endZone(110, rightColor, rightTeam, Math.PI / 2)

  g.strokeStyle = "rgba(255,255,255,0.9)"
  g.fillStyle = "rgba(255,255,255,0.9)"

  // Yard lines every 5 yards; goal lines thicker
  for (let x = 10; x <= 110; x += 5) {
    g.lineWidth = x === 10 || x === 110 ? 8 : 4
    g.beginPath()
    g.moveTo(x * PX, 0)
    g.lineTo(x * PX, H)
    g.stroke()
  }

  // Hash marks (NFL hashes 70'9" from each sideline) and sideline ticks
  const hashes = [1, 23.58, FIELD_H - 23.58 - 0.67, FIELD_H - 1.67]
  for (let x = 11; x < 110; x++) {
    if (x % 5 === 0) continue
    for (const y of hashes) g.fillRect(x * PX - 1.5, y * PX, 3, 0.67 * PX)
  }

  // Perimeter
  g.lineWidth = 12
  g.strokeRect(0, 0, c.width, H)

  // Yard numbers (near sideline upright toward the broadcast camera, far side flipped)
  g.font = `700 ${2 * PX}px system-ui, sans-serif`
  g.textAlign = "center"
  g.textBaseline = "middle"
  for (let x = 20; x <= 100; x += 10) {
    const label = String(x <= 60 ? x - 10 : 110 - x)
    g.fillText(label, x * PX, (FIELD_H - 12) * PX)
    g.save()
    g.translate(x * PX, 12 * PX)
    g.rotate(Math.PI)
    g.fillText(label, 0, 0)
    g.restore()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** Billboard texture for the jumbotron / ribbon boards. */
export function makeBoardTexture(lines: string[], accent = "#22d3ee", w = 1024, h = 256) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const g = c.getContext("2d")!
  g.fillStyle = "#05070c"
  g.fillRect(0, 0, w, h)
  g.fillStyle = accent
  g.fillRect(0, h - 10, w, 10)
  g.textAlign = "center"
  g.textBaseline = "middle"
  lines.forEach((t, i) => {
    g.fillStyle = i === 0 ? "#ffffff" : accent
    g.font = `${i === 0 ? 800 : 600} ${i === 0 ? h * 0.3 : h * 0.18}px system-ui, sans-serif`
    g.fillText(t, w / 2, (h / (lines.length + 1)) * (i + 1))
  })
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
