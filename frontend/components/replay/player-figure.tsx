"use client"

import { useMemo, useRef, type MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { Frame } from "@/lib/akit"
import { toWorld } from "./stadium"

export interface Sample {
  x: number
  y: number
  s: number
  /** Heading in radians about world Y (0 = facing +Z). */
  heading: number
}

const lerpAngle = (a: number, b: number, t: number) => {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  return a + d * t
}

/** NGS angles: degrees clockwise from +y; with world Z = y this maps to atan2(sin, cos). */
const headingOf = (f: Frame) => {
  const deg = f[2] > 0.4 ? f[4] : f[3]
  const r = (deg * Math.PI) / 180
  return Math.atan2(Math.sin(r), Math.cos(r))
}

/** Interpolated player state at fractional frame time t. */
export function sample(frames: Frame[], t: number): Sample {
  const n = frames.length
  const i = Math.max(0, Math.min(n - 1, Math.floor(t)))
  const j = Math.min(n - 1, i + 1)
  const k = Math.min(1, Math.max(0, t - i))
  const a = frames[i]
  const b = frames[j]
  return {
    x: a[0] + (b[0] - a[0]) * k,
    y: a[1] + (b[1] - a[1]) * k,
    s: a[2] + (b[2] - a[2]) * k,
    heading: lerpAngle(headingOf(a), headingOf(b), k),
  }
}

function jerseyTexture(text: string, color: string, ink: string) {
  const c = document.createElement("canvas")
  c.width = 128
  c.height = 128
  const g = c.getContext("2d")!
  g.fillStyle = color
  g.fillRect(0, 0, 128, 128)
  g.fillStyle = ink
  g.font = "900 64px system-ui, sans-serif"
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillText(text, 64, 70)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

interface Props {
  frames: Frame[]
  timeRef: MutableRefObject<number>
  color: string
  secondary: string
  label: string
  ringColor: string
}

export function PlayerFigure({ frames, timeRef, color, secondary, label, ringColor }: Props) {
  const root = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const phase = useRef(0)
  const back = useMemo(() => jerseyTexture(label, color, secondary), [label, color, secondary])

  useFrame((state, dt) => {
    if (!root.current) return
    const p = sample(frames, timeRef.current)
    const [wx, wz] = toWorld(p.x, p.y)
    root.current.position.set(wx, 0, wz)
    root.current.rotation.y = p.heading
    // Stride frequency rises with speed; amplitude saturates near top speed.
    phase.current += dt * (2.2 + p.s * 0.9)
    const amp = Math.min(1, p.s / 7) * 0.9
    const sw = Math.sin(phase.current) * amp
    legL.current!.rotation.x = sw
    legR.current!.rotation.x = -sw
    armL.current!.rotation.x = -sw * 0.8
    armR.current!.rotation.x = sw * 0.8
    body.current!.position.y = Math.abs(Math.cos(phase.current)) * 0.06 * amp
    body.current!.rotation.x = amp * 0.25 // lean into the run
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.08
    ring.current!.scale.setScalar(pulse)
  })

  const pants = "#e5e7eb"
  return (
    <group ref={root}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.75, 0.95, 48]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.7, 32]} />
        <meshBasicMaterial color="#000" transparent opacity={0.35} />
      </mesh>

      <group ref={body}>
        {/* legs pivot at the hip */}
        {[
          [legL, -0.16],
          [legR, 0.16],
        ].map(([ref, x]) => (
          <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 1.0, 0]}>
            <mesh position={[0, -0.42, 0]} castShadow>
              <capsuleGeometry args={[0.13, 0.6, 4, 10]} />
              <meshStandardMaterial color={pants} roughness={0.6} />
            </mesh>
            <mesh position={[0, -0.92, 0.06]} castShadow>
              <boxGeometry args={[0.2, 0.12, 0.34]} />
              <meshStandardMaterial color="#111" />
            </mesh>
          </group>
        ))}

        {/* torso + jersey */}
        <mesh position={[0, 1.35, 0]} castShadow>
          <capsuleGeometry args={[0.3, 0.4, 4, 12]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.62, 0]} castShadow>
          <boxGeometry args={[0.95, 0.22, 0.5]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.38, -0.31]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.46, 0.46]} />
          <meshBasicMaterial map={back} toneMapped={false} />
        </mesh>

        {/* arms pivot at the shoulder */}
        {[
          [armL, -0.52],
          [armR, 0.52],
        ].map(([ref, x]) => (
          <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 1.6, 0]}>
            <mesh position={[0, -0.3, 0]} castShadow>
              <capsuleGeometry args={[0.09, 0.42, 4, 8]} />
              <meshStandardMaterial color={color} roughness={0.5} />
            </mesh>
          </group>
        ))}

        {/* helmet + facemask */}
        <mesh position={[0, 1.98, 0]} castShadow>
          <sphereGeometry args={[0.24, 24, 16]} />
          <meshStandardMaterial color={secondary} metalness={0.4} roughness={0.25} />
        </mesh>
        <mesh position={[0, 1.93, 0.2]}>
          <boxGeometry args={[0.3, 0.14, 0.08]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}
