'use client'
import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, MeshReflectorMaterial, Float } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import * as THREE from 'three'

/**
 * Orrery3D — the calendar hero, rendered in WebGL.
 *
 * Four gyroscopic rings, one per score. The DATA drives the arc: a ring's
 * sweep is its percentage, so a 90% year is nine tenths of a torus. Colour is
 * fixed per orbit instead — cool violet outside warming to saffron at the core
 * — because score-driven colour made the whole object one hue on a good day,
 * which is exactly when it should look best.
 *
 * Why this reads "expensive" where the SVG version did not:
 *  - a real environment map. The glassy, iridescent sheen is a REFLECTION of
 *    surrounding light, not a colour. Built procedurally from Lightformers so
 *    there is no HDRI to download.
 *  - iridescence on a physical material — the oil-slick shift across the
 *    metal, which is what the ultraviolet look in the reference actually is.
 *  - bloom as a render pass, so bright edges bleed light instead of wearing a
 *    CSS shadow.
 *  - a blurred reflective floor plus fog, which puts the object in a space
 *    rather than on a background.
 *
 * Desktop only, mounted lazily — see OrreryHero.
 */

export type OrreryScores = {
  dayPct: number | null
  weekPct: number | null
  monthPct: number | null
  yearPct: number | null
}

type Orbit = {
  pct: number
  radius: number
  tube: number
  color: string
  euler: [number, number, number]
  speed: number
}

const clamp = (v: number | null) => Math.max(0, Math.min(100, v ?? 0))

function Gyroscope({ dayPct, weekPct, monthPct, yearPct }: OrreryScores) {
  const group = useRef<THREE.Group>(null)

  // Cool outside, warm at the core: the Iris-to-Saffron gradient the palette
  // is already built on.
  const orbits: Orbit[] = useMemo(() => [
    { pct: clamp(yearPct),  radius: 2.35, tube: 0.028, color: '#8052ff', euler: [1.42, 0, 0],      speed: 0.055 },
    { pct: clamp(monthPct), radius: 1.85, tube: 0.030, color: '#9b7bff', euler: [1.05, 0.55, 0.3], speed: -0.08 },
    { pct: clamp(weekPct),  radius: 1.38, tube: 0.032, color: '#c9a4ff', euler: [0.72, -0.6, -0.4],speed: 0.115 },
    { pct: clamp(dayPct),   radius: 0.92, tube: 0.034, color: '#ffb829', euler: [0.25, 0.9, 0.5],  speed: -0.16 },
  ], [dayPct, weekPct, monthPct, yearPct])

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.045
  })

  return (
    <group ref={group}>
      {orbits.map((o, i) => <Orbit key={i} orbit={o} />)}

      {/* Core. Emissive so bloom catches it and it reads as the light source
          the rings are lit by. */}
      <mesh>
        <icosahedronGeometry args={[0.30, 2]} />
        <meshPhysicalMaterial
          color="#1a1030"
          emissive="#8052ff"
          emissiveIntensity={2.4}
          roughness={0.12}
          metalness={0.9}
          iridescence={1}
          iridescenceIOR={1.9}
        />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={7} distance={7} color="#a882ff" />
    </group>
  )
}

function Orbit({ orbit }: { orbit: Orbit }) {
  const ref = useRef<THREE.Group>(null)
  const { pct, radius, tube, color, euler, speed } = orbit
  const arc = (pct / 100) * Math.PI * 2

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * speed
  })

  return (
    <group rotation={euler}>
      <group ref={ref}>
        {/* Full track — the unearned remainder of the ring, nearly invisible */}
        <mesh>
          <torusGeometry args={[radius, tube * 0.55, 12, 220]} />
          <meshPhysicalMaterial color="#2a2a38" roughness={0.35} metalness={1} />
        </mesh>

        {/* The score arc itself */}
        {pct > 0.5 && (
          <mesh>
            <torusGeometry args={[radius, tube, 20, 260, arc]} />
            <meshPhysicalMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.85}
              roughness={0.14}
              metalness={1}
              iridescence={1}
              iridescenceIOR={1.75}
              iridescenceThicknessRange={[100, 640]}
              clearcoat={1}
              clearcoatRoughness={0.08}
            />
          </mesh>
        )}

        {/* Body riding the orbit at its current value */}
        <mesh position={[radius * Math.cos(arc), radius * Math.sin(arc), 0]}>
          <sphereGeometry args={[tube * 2.6, 24, 24]} />
          <meshPhysicalMaterial
            color={color}
            emissive={color}
            emissiveIntensity={3}
            roughness={0.1}
            metalness={0.6}
          />
        </mesh>
      </group>
    </group>
  )
}

export default function Orrery3D(scores: OrreryScores) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 1.15, 6.4], fov: 38 }}
      style={{ background: 'transparent' }}
    >
      <Suspense fallback={null}>
      <fog attach="fog" args={['#04040c', 7, 17]} />
      <ambientLight intensity={0.22} />

      {/* Procedural environment. This is what makes the metal look like metal —
          without it the rings render as flat plastic. Lightformers mean no HDRI
          fetch, so it costs nothing to load. */}
      <Environment resolution={256}>
        <Lightformer intensity={2.6} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} color="#b79bff" />
        <Lightformer intensity={1.5} rotation-y={Math.PI / 2} position={[-6, 1, 0]} scale={[20, 3, 1]} color="#5b6cff" />
        <Lightformer intensity={2.2} rotation-y={-Math.PI / 2} position={[6, 2, 0]} scale={[20, 3, 1]} color="#ffb070" />
        <Lightformer intensity={1.1} rotation-x={-Math.PI / 2} position={[0, -4, 2]} scale={[14, 14, 1]} color="#2a2050" />
      </Environment>

      <Float speed={1.1} rotationIntensity={0.16} floatIntensity={0.35}>
        <Gyroscope {...scores} />
      </Float>

      {/* Blurred reflective floor. Puts the object in a space instead of on a
          background — the single cheapest way to buy depth in a 3D scene. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
        <planeGeometry args={[60, 60]} />
        <MeshReflectorMaterial
          blur={[420, 90]}
          resolution={512}
          mixBlur={1}
          mixStrength={26}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.35}
          roughness={0.92}
          color="#05050d"
          metalness={0.55}
          mirror={0}
        />
      </mesh>

      <EffectComposer enableNormalPass={false}>
        <Bloom intensity={1.15} luminanceThreshold={0.32} luminanceSmoothing={0.9} mipmapBlur radius={0.75} />
        <ChromaticAberration offset={[0.0006, 0.0009]} radialModulation={false} modulationOffset={0} />
        <Vignette eskil={false} offset={0.24} darkness={0.85} />
      </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
