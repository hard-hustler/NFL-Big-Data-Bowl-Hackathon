"use client"

import { useEffect, useMemo, useRef, type MutableRefObject } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Line, OrbitControls, Stars } from "@react-three/drei"
import * as THREE from "three"
import {
  AKIT,
  DEFENSE_COLOR,
  DOMINANCE_COLOR,
  dominance,
  fieldOf,
  GRID,
  OFFENSE_COLOR,
  stateAt,
  TAU_RADIUS,
  type AkitDetail,
  type AkitPlayer,
} from "@/lib/akit"
import { teamColors } from "@/lib/teams"
import { FIELD_H } from "./field-texture"
import { LabelSprite } from "./label-sprite"
import { PlayerFigure, sample } from "./player-figure"
import { Stadium, toWorld } from "./stadium"

export type AkitCamera = "broadcast" | "overhead" | "all22" | "follow" | "orbit"

interface SceneProps {
  play: AkitDetail
  timeRef: MutableRefObject<number>
  playing: boolean
  speed: number
  camera: AkitCamera
  showFields: boolean
  onFrame: (frame: number) => void
  onEnd: () => void
}

const lastName = (n: string) => n.split(" ").slice(-1)[0]

function Playback({ play, timeRef, playing, speed, onFrame, onEnd }: Omit<SceneProps, "camera" | "showFields">) {
  const last = useRef(-1)
  const end = play.players[0].frames.length - 1
  useFrame((_, dt) => {
    if (playing) {
      timeRef.current = Math.min(end, timeRef.current + Math.min(dt, 0.1) * 10 * speed)
      if (timeRef.current >= end) onEnd()
    }
    const f = Math.floor(timeRef.current)
    if (f !== last.current) {
      last.current = f
      onFrame(f)
    }
  })
  return null
}

function CameraRig({ play, timeRef, mode }: { play: AkitDetail; timeRef: MutableRefObject<number>; mode: AkitCamera }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3())
  const pos = useRef(new THREE.Vector3())
  const target = play.players[0]
  const [landX, landZ] = toWorld(play.meta.land_x, play.meta.land_y)
  useFrame((_, dt) => {
    if (mode === "orbit") return
    const p = sample(target.frames, timeRef.current)
    const [wx, wz] = toWorld(p.x, p.y)
    if (mode === "broadcast") {
      pos.current.set(wx - 4, 22, FIELD_H / 2 + 20)
      look.current.set(wx + 3, 0, wz * 0.5)
    } else if (mode === "overhead") {
      // Straight down over the arrival window so the dominance map reads like a chart.
      pos.current.set((wx + landX) / 2, 46, (wz + landZ) / 2 + 0.01)
      look.current.set((wx + landX) / 2, 0, (wz + landZ) / 2)
    } else if (mode === "all22") {
      const [losX] = toWorld(play.meta.los_x, 0)
      pos.current.set(losX - 36, 40, 0)
      look.current.set(losX + 14, 0, 0)
    } else {
      const hx = Math.sin(p.heading)
      const hz = Math.cos(p.heading)
      pos.current.set(wx - hx * 9, 5.5, wz - hz * 9)
      look.current.set(wx + hx * 8, 1.2, wz + hz * 8)
    }
    const k = 1 - Math.exp(-dt * (mode === "follow" ? 4 : 2.5))
    camera.position.lerp(pos.current, k)
    const cur = new THREE.Vector3()
    camera.getWorldDirection(cur).add(camera.position)
    camera.lookAt(cur.lerp(look.current, k))
  })
  return null
}

function FieldLine({ x, color, label }: { x: number; color: string; label: string }) {
  const [wx] = toWorld(x, 0)
  return (
    <group position={[wx, 0.04, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.3, FIELD_H]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} toneMapped={false} />
      </mesh>
      <LabelSprite lines={[label]} position={[0, 0.8, FIELD_H / 2 + 1.5]} fg={color} height={1.1} />
    </group>
  )
}

/**
 * Ownership map over the 30x30 yd window around the target 0.5 s after the throw, recomputed every render frame from the
 * interpolated player states: teal = receiver dominates, orange = defense controls.
 */
function DominanceLayer({ play, timeRef }: { play: AkitDetail; timeRef: MutableRefObject<number> }) {
  const { meta, players } = play
  const mesh = useRef<THREE.Mesh>(null)
  const own = useMemo(() => new Int8Array(GRID * GRID), [])
  const tex = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array(GRID * GRID * 4), GRID, GRID, THREE.RGBAFormat)
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearFilter
    t.flipY = false
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  const rec = players.find((p) => p.targeted)!
  const defs = players.filter((p) => p.side === "defense")
  const teal = new THREE.Color(DOMINANCE_COLOR)
  const orange = new THREE.Color(DEFENSE_COLOR)
  const [wx, wz] = toWorld(meta.land_x, meta.land_y)

  useFrame(() => {
    const t = timeRef.current
    const visible = t >= meta.release_frame - 0.01
    if (mesh.current) mesh.current.visible = visible
    if (!visible) return
    dominance(fieldOf(stateAt(rec.frames, t)), defs.map((d) => fieldOf(stateAt(d.frames, t))), meta.land_x, meta.land_y, own)
    const data = tex.image.data as Uint8Array
    // DataTexture row 0 is the plane's bottom edge, which faces +Z (high field y) after the -90deg tilt.
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const v = own[r * GRID + c]
        const i = ((GRID - 1 - r) * GRID + c) * 4
        const col = v === 1 ? teal : orange
        data[i] = col.r * 255
        data[i + 1] = col.g * 255
        data[i + 2] = col.b * 255
        data[i + 3] = v === 1 ? 150 : 0
      }
    }
    tex.needsUpdate = true
  })

  const size = AKIT.half * 2
  const outline = useMemo(() => {
    const h = AKIT.half
    return [[-h, 0, -h], [h, 0, -h], [h, 0, h], [-h, 0, h], [-h, 0, -h]] as [number, number, number][]
  }, [])
  return (
    <group position={[wx, 0.07, wz]}>
      <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <Line points={outline} color="#ffffff" lineWidth={1} transparent opacity={0.25} dashed dashSize={0.8} gapSize={0.6} />
    </group>
  )
}

/** The player's influence ellipse at tau: shifted along velocity, stretched along orientation. */
function InfluenceEllipse({ player, timeRef, color }: { player: AkitPlayer; timeRef: MutableRefObject<number>; color: string }) {
  const group = useRef<THREE.Group>(null)
  const shape = useRef<THREE.Group>(null)
  useFrame(() => {
    const f = fieldOf(stateAt(player.frames, timeRef.current))
    const [wx, wz] = toWorld(f.mx, f.my)
    group.current?.position.set(wx, 0.09, wz)
    if (group.current) group.current.rotation.y = Math.atan2(f.ux, f.uy)
    shape.current?.scale.set(f.st * TAU_RADIUS, f.sl * TAU_RADIUS, 1)
  })
  return (
    <group ref={group}>
      <group ref={shape} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <ringGeometry args={[0.97, 1, 72]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <circleGeometry args={[1, 72]} />
          <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

/** The football. Tracking is 2D, so height is drawn as a gentle rise after the release (illustrative only). */
function Football({ ball, timeRef, release }: { ball: AkitPlayer; timeRef: MutableRefObject<number>; release: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const t = timeRef.current
    const a = sample(ball.frames, t)
    const b = sample(ball.frames, t + 1)
    const [wx, wz] = toWorld(a.x, a.y)
    const h = t < release ? 1.4 : 1.8 + Math.min(t - release, 5) * 0.35
    mesh.current?.position.set(wx, h, wz)
    if (mesh.current && Math.hypot(b.x - a.x, b.y - a.y) > 0.05) mesh.current.rotation.y = Math.atan2(b.x - a.x, b.y - a.y)
  })
  return (
    <mesh ref={mesh} scale={[0.17, 0.17, 0.3]} castShadow>
      <sphereGeometry args={[1, 20, 14]} />
      <meshStandardMaterial color="#7c3f1d" roughness={0.6} />
    </mesh>
  )
}

function Tag({ player, timeRef, fg, bg }: { player: AkitPlayer; timeRef: MutableRefObject<number>; fg: string; bg?: string }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    const p = sample(player.frames, timeRef.current)
    const [wx, wz] = toWorld(p.x, p.y)
    group.current?.position.set(wx, player.targeted ? 3.2 : 2.8, wz)
  })
  const name = lastName(player.display_name)
  const lines =
    player.role === "target"
      ? [`${name} · Target`]
      : player.role === "option"
        ? [`${name} · Most space`]
        : [`${name} ${player.position}`]
  return (
    <group ref={group}>
      <LabelSprite lines={lines} fg={fg} bg={bg} height={player.targeted ? 1.1 : 0.85} />
    </group>
  )
}

function Trail({ player, color, from }: { player: AkitPlayer; color: string; from: number }) {
  const pts = useMemo(
    () => player.frames.slice(from).map((f) => {
      const [x, z] = toWorld(f[0], f[1])
      return [x, 0.05, z] as [number, number, number]
    }),
    [player, from]
  )
  return pts.length > 1 ? <Line points={pts} color={color} lineWidth={1.5} transparent opacity={0.35} /> : null
}

function SceneContent(props: SceneProps) {
  const { play, timeRef, camera, showFields } = props
  const m = play.meta
  const opponent = m.possession_team === m.home_team_abbr ? m.visitor_team_abbr : m.home_team_abbr
  const [off1, off2] = teamColors(m.possession_team)
  const [def1, def2] = teamColors(opponent)
  const [home1] = teamColors(m.home_team_abbr)
  const firstDown = Math.min(110, m.los_x + m.yards_to_go)
  const target = play.players[0]
  const ball = play.players.find((p) => p.role === "ball")
  // Three figures: thrower, target, closest defender. Other defenders stay in the data for the space map.
  const people = play.players.filter((p) => p.role === "target" || p.role === "passer" || (p.role === "defense" && p.primary))

  return (
    <>
      <color attach="background" args={["#04060b"]} />
      <fog attach="fog" args={["#04060b", 140, 320]} />
      <Stars radius={250} depth={60} count={2500} factor={6} fade speed={0.4} />
      <hemisphereLight args={["#b9c7ff", "#0b1a0b", 0.6]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[30, 80, 40]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />

      <Stadium
        leftTeam={m.possession_team}
        leftColor={off1}
        rightTeam={opponent}
        rightColor={def1}
        homeColor={home1}
        boardTitle={`${m.display_name.toUpperCase()} · SPACE AT THE THROW`}
        boardSubtitle={`DSV ${m.dsv_release.toFixed(0)} YD² · #${m.dsv_rank} OF ${m.n_options} OPTIONS`}
      />

      <FieldLine x={m.los_x} color="#3b82f6" label="LOS" />
      {firstDown < 110 && <FieldLine x={firstDown} color="#facc15" label="1ST DOWN" />}

      {showFields && <DominanceLayer play={play} timeRef={timeRef} />}

      {ball && <Football ball={ball} timeRef={timeRef} release={m.release_frame} />}
      {people.map((p) => {
        const off = p.side === "offense"
        const ring = p.role === "target" ? DOMINANCE_COLOR : off ? OFFENSE_COLOR : DEFENSE_COLOR
        return (
          <group key={p.nfl_id}>
            {(p.role === "target" || p.role === "option") && <Trail player={p} color={ring} from={m.snap_frame} />}
            {showFields && p.role !== "passer" && <InfluenceEllipse player={p} timeRef={timeRef} color={ring} />}
            <PlayerFigure
              frames={p.frames}
              timeRef={timeRef}
              color={off ? off1 : def1}
              secondary={off ? off2 : def2}
              label={p.position}
              ringColor={ring}
            />
            <Tag
              player={p}
              timeRef={timeRef}
              fg={p.role === "target" ? "#000000" : "#ffffff"}
              bg={p.role === "target" ? DOMINANCE_COLOR : p.role === "option" ? OFFENSE_COLOR : undefined}
            />
          </group>
        )
      })}

      <Playback {...props} />
      <CameraRig play={play} timeRef={timeRef} mode={camera} />
      {camera === "orbit" && (
        <OrbitControls
          makeDefault
          target={(() => {
            const p = sample(target.frames, timeRef.current)
            const [x, z] = toWorld(p.x, p.y)
            return [x, 0, z] as [number, number, number]
          })()}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={6}
          maxDistance={160}
        />
      )}
    </>
  )
}

export default function AkitScene(props: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [-20, 30, 70], fov: 42, near: 0.5, far: 1000 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <SceneContent {...props} />
    </Canvas>
  )
}
