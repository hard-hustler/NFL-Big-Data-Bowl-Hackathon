"use client"

import { useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { FIELD_H, FIELD_W, makeBoardTexture, makeFieldTexture } from "./field-texture"

/** Field (x, y) in yards -> world [X, Z]. Field center is the world origin, 1 unit = 1 yard. */
export const toWorld = (x: number, y: number): [number, number] => [x - FIELD_W / 2, y - FIELD_H / 2]

/** Points spaced `step` apart along a rounded rectangle centered on the field. */
function roundedRectPath(hx: number, hz: number, r: number, step: number) {
  const pts: { x: number; z: number; a: number }[] = []
  const sx = hx - r
  const sz = hz - r
  const segs: Array<(t: number) => { x: number; z: number; a: number }> = []
  const lens: number[] = []
  const line = (x0: number, z0: number, x1: number, z1: number, a: number) => {
    segs.push((t) => ({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, a }))
    lens.push(Math.hypot(x1 - x0, z1 - z0))
  }
  const arc = (cx: number, cz: number, a0: number) => {
    segs.push((t) => {
      const a = a0 + (t * Math.PI) / 2
      return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, a }
    })
    lens.push((Math.PI / 2) * r)
  }
  line(-sx, hz, sx, hz, Math.PI / 2)
  arc(sx, sz, Math.PI / 2 - Math.PI / 2)
  line(hx, sz, hx, -sz, 0)
  arc(sx, -sz, -Math.PI / 2)
  line(sx, -hz, -sx, -hz, -Math.PI / 2)
  arc(-sx, -sz, Math.PI)
  line(-hx, -sz, -hx, sz, Math.PI)
  arc(-sx, sz, Math.PI / 2)
  segs.forEach((f, i) => {
    const n = Math.max(1, Math.round(lens[i] / step))
    for (let k = 0; k < n; k++) pts.push(f(k / n))
  })
  return pts
}

const CROWD = ["#e5e7eb", "#94a3b8", "#1e293b", "#b91c1c", "#1d4ed8", "#f59e0b", "#334155", "#0f766e", "#7c3aed"]

function Stands({ homeColor }: { homeColor: string }) {
  const risers = useRef<THREE.InstancedMesh>(null)
  const fans = useRef<THREE.InstancedMesh>(null)

  const seats = useMemo(() => {
    const out: { x: number; z: number; a: number; h: number; row: number }[] = []
    const rows = 34
    for (let row = 0; row < rows; row++) {
      const upper = row >= 18
      const off = 7 + row * 1.15 + (upper ? 3 : 0)
      const h = 2 + row * 0.8 + (upper ? 5 : 0)
      for (const p of roundedRectPath(FIELD_W / 2 + off, FIELD_H / 2 + off, 10 + off * 0.6, 1.25)) {
        out.push({ ...p, h, row })
      }
    }
    return out
  }, [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const col = new THREE.Color()
    const up = new THREE.Vector3(0, 1, 0)
    seats.forEach((s, i) => {
      q.setFromAxisAngle(up, Math.PI / 2 - s.a)
      m.compose(new THREE.Vector3(s.x, s.h / 2, s.z), q, new THREE.Vector3(1.2, s.h, 1.3))
      risers.current!.setMatrixAt(i, m)
      m.compose(new THREE.Vector3(s.x, s.h + 0.35, s.z), q, new THREE.Vector3(0.8, 0.7, 0.6))
      fans.current!.setMatrixAt(i, m)
      // ~30% of the crowd wears the home team's color
      col.set(Math.random() < 0.3 ? homeColor : CROWD[(i * 7919) % CROWD.length])
      col.multiplyScalar(0.55 + Math.random() * 0.35)
      fans.current!.setColorAt(i, col)
    })
    risers.current!.instanceMatrix.needsUpdate = true
    fans.current!.instanceMatrix.needsUpdate = true
    if (fans.current!.instanceColor) fans.current!.instanceColor.needsUpdate = true
  }, [seats, homeColor])

  return (
    <group>
      <instancedMesh ref={risers} args={[undefined, undefined, seats.length]} receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color="#1b1f27" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={fans} args={[undefined, undefined, seats.length]}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
    </group>
  )
}

/** LED ribbon board running around the lower deck facade. */
function Ribbon() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const pts = useMemo(() => {
    const off = 7 + 17 * 1.15 + 1.6
    return roundedRectPath(FIELD_W / 2 + off, FIELD_H / 2 + off, 10 + off * 0.6, 1.5)
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    pts.forEach((p, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 - p.a)
      m.compose(new THREE.Vector3(p.x, 2 + 17 * 0.8 + 2.2, p.z), q, new THREE.Vector3(1.55, 1.6, 0.3))
      ref.current!.setMatrixAt(i, m)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [pts])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, pts.length]}>
      <boxGeometry />
      <meshStandardMaterial color="#0e7490" emissive="#22d3ee" emissiveIntensity={0.9} toneMapped={false} />
    </instancedMesh>
  )
}

function LightTower({ x, z }: { x: number; z: number }) {
  // Spotlight target sits at the field center (local coords of the tower group)
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(-x, 0, -z)
    return o
  }, [x, z])
  const yaw = Math.atan2(-x, -z)
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 26, 0]}>
        <cylinderGeometry args={[0.5, 0.9, 52, 8]} />
        <meshStandardMaterial color="#2a2f38" metalness={0.6} roughness={0.5} />
      </mesh>
      <group position={[0, 53, 0]} rotation={[0, yaw, 0]}>
        <mesh rotation={[-0.5, 0, 0]}>
          <boxGeometry args={[12, 6, 0.8]} />
          <meshStandardMaterial color="#f8fafc" emissive="#fffbe6" emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
      </group>
      <primitive object={target} />
      <spotLight position={[0, 53, 0]} target={target} angle={0.55} penumbra={0.6} intensity={9000} distance={260} decay={2} color="#fff7e0" />
    </group>
  )
}

function Goalpost({ x }: { x: number }) {
  const mat = <meshStandardMaterial color="#facc15" emissive="#a16207" emissiveIntensity={0.3} />
  const dir = x < 0 ? -1 : 1
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[dir * 1.2, 1.7, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 3.4]} />
        {mat}
      </mesh>
      <mesh position={[dir * 0.6, 3.33, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 1.3]} />
        {mat}
      </mesh>
      <mesh position={[0, 3.33, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 6.17]} />
        {mat}
      </mesh>
      {[-3.08, 3.08].map((z) => (
        <mesh key={z} position={[0, 3.33 + 5, z]}>
          <cylinderGeometry args={[0.06, 0.06, 10]} />
          {mat}
        </mesh>
      ))}
    </group>
  )
}

function Jumbotron({ title, subtitle }: { title: string; subtitle: string }) {
  const tex = useMemo(() => makeBoardTexture([title, subtitle]), [title, subtitle])
  const x = FIELD_W / 2 + 7 + 33 * 1.15 + 8
  return (
    <group position={[x, 34, 0]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh>
        <planeGeometry args={[48, 12]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.6]}>
        <boxGeometry args={[50, 14, 1]} />
        <meshStandardMaterial color="#0b0d12" />
      </mesh>
      <mesh position={[0, -20, -0.6]}>
        <boxGeometry args={[2, 28, 2]} />
        <meshStandardMaterial color="#1f2430" />
      </mesh>
    </group>
  )
}

export interface StadiumProps {
  leftTeam: string
  leftColor: string
  rightTeam: string
  rightColor: string
  homeColor: string
  boardTitle: string
  boardSubtitle: string
}

export function Stadium({ leftTeam, leftColor, rightTeam, rightColor, homeColor, boardTitle, boardSubtitle }: StadiumProps) {
  const fieldTex = useMemo(
    () => makeFieldTexture(leftTeam, leftColor, rightTeam, rightColor),
    [leftTeam, leftColor, rightTeam, rightColor]
  )
  const towers: [number, number][] = [
    [-95, -70],
    [95, -70],
    [-95, 70],
    [95, 70],
  ]
  return (
    <group>
      {/* Ground + sideline apron */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#0b0f0c" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[FIELD_W + 14, FIELD_H + 16]} />
        <meshStandardMaterial color="#1f4d22" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_W, FIELD_H]} />
        <meshStandardMaterial map={fieldTex} roughness={0.9} />
      </mesh>

      <Goalpost x={-FIELD_W / 2} />
      <Goalpost x={FIELD_W / 2} />
      <Stands homeColor={homeColor} />
      <Ribbon />
      <Jumbotron title={boardTitle} subtitle={boardSubtitle} />
      {towers.map(([x, z]) => (
        <LightTower key={`${x}${z}`} x={x} z={z} />
      ))}
    </group>
  )
}
