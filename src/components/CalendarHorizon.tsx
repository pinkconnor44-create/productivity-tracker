'use client'
import { useEffect, useRef, useState } from 'react'
import { scoreColor } from '@/components/ui'

/**
 * CalendarHorizon — the calendar page's hero backdrop.
 *
 * An orrery suspended over an alpine horizon at blue hour. Four nested rings,
 * each tilted onto its own orbital plane, sized and lit by the Day / Week /
 * Month / Year scores that the stat strip below already reports. It is the
 * stat strip rendered as an instrument, so it carries information rather than
 * being ornament.
 *
 * Depth comes from stacking the cues real scenes have, not from a 3D library:
 *   1. atmospheric perspective — distant ridges are lighter, hazier, flatter
 *   2. occlusion — each ridge overlaps the one behind it
 *   3. a ground grid converging on a vanishing point
 *   4. genuine 3D rotation (preserve-3d + per-ring rotateX/Z)
 *   5. parallax — layers track the pointer at different rates
 * Total cost is a few KB of CSS and SVG. No WebGL, no textures, no library,
 * which matters for a PWA opened on mobile data.
 *
 * LAYOUT CONTRACT — this component must stay a *sibling* of the calendar
 * content, never an ancestor. It establishes `perspective`, and any ancestor
 * with perspective/transform/filter becomes the containing block for
 * `position: fixed` descendants. DayModal is fixed and lives inside the
 * calendar column, so wrapping content in this would break the modal.
 */

type Props = {
  dayPct: number | null
  weekPct: number | null
  monthPct: number | null
  yearPct: number | null
}

type Orbit = {
  label: string
  pct: number | null
  size: number
  /** Tilt toward edge-on. Outer orbits lie flatter, like orbital planes. */
  tiltX: number
  spinZ: number
  /** Seconds per revolution. Outer orbits are slower — Kepler, loosely. */
  period: number
  reverse?: boolean
}

export default function CalendarHorizon({ dayPct, weekPct, monthPct, yearPct }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [par, setPar] = useState({ x: 0, y: 0 })
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const set = () => setReduced(mq.matches)
    set()
    mq.addEventListener('change', set)
    return () => mq.removeEventListener('change', set)
  }, [])

  // Pointer parallax. Desktop only — a finger dragging across a phone is
  // scrolling, not aiming. rAF-coalesced so a fast mouse can't outrun paint.
  useEffect(() => {
    if (reduced) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const el = ref.current
    if (!el) return
    let frame = 0
    const onMove = (e: PointerEvent) => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const r = el.getBoundingClientRect()
        setPar({
          x: ((e.clientX - r.left) / r.width - 0.5) * 2,
          y: ((e.clientY - r.top) / r.height - 0.5) * 2,
        })
      })
    }
    const onLeave = () => setPar({ x: 0, y: 0 })
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [reduced])

  const orbits: Orbit[] = [
    { label: 'Year',  pct: yearPct,  size: 300, tiltX: 74, spinZ: 0,   period: 150 },
    { label: 'Month', pct: monthPct, size: 232, tiltX: 66, spinZ: 28,  period: 104, reverse: true },
    { label: 'Week',  pct: weekPct,  size: 168, tiltX: 56, spinZ: -22, period: 72 },
    { label: 'Day',   pct: dayPct,   size: 108, tiltX: 26, spinZ: 12,  period: 46, reverse: true },
  ]

  // Distant things move least. That difference IS the depth.
  const shift = (depth: number) => ({
    transform: `translate3d(${par.x * depth}px, ${par.y * depth * 0.5}px, 0)`,
  })

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[460px] overflow-hidden -z-[1]"
      style={{ maskImage: 'linear-gradient(to bottom, #000 55%, transparent 100%)',
               WebkitMaskImage: 'linear-gradient(to bottom, #000 55%, transparent 100%)' }}
    >
      {/* Sky — blue hour. Deep indigo lifting to a violet band at the horizon. */}
      <div className="absolute inset-0" style={{
        background:
          'radial-gradient(120% 80% at 50% 92%, rgba(128,82,255,0.22) 0%, rgba(60,40,120,0.12) 34%, transparent 68%),' +
          'linear-gradient(to bottom, #000 0%, #05040d 42%, #0a0718 72%, #120a24 100%)',
      }} />

      {/* Horizon glow — the light source everything else is lit by. */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{
        bottom: 96, width: 900, height: 260,
        background: 'radial-gradient(closest-side, rgba(160,120,255,0.30), rgba(128,82,255,0.10) 55%, transparent 100%)',
        ...shift(3),
      }} />

      {/* ── Ridges, far to near. Each is lighter and hazier than the one in
             front of it, and each overlaps the one behind. ── */}
      <Ridge d="M0,150 L120,96 L210,126 L330,58 L430,104 L560,44 L660,92 L780,52 L900,104 L1000,74 L1200,120 L1200,300 L0,300 Z"
             fill="rgba(150,130,220,0.20)" bottom={104} depth={4} par={par} blur={2.5} />
      <Ridge d="M0,170 L100,120 L230,166 L340,104 L470,152 L590,88 L700,140 L840,96 L960,148 L1100,110 L1200,150 L1200,300 L0,300 Z"
             fill="rgba(96,80,160,0.34)" bottom={72} depth={8} par={par} blur={1.2} />
      <Ridge d="M0,190 L140,132 L280,186 L400,120 L520,178 L650,112 L790,172 L920,124 L1060,180 L1200,140 L1200,300 L0,300 Z"
             fill="rgba(40,32,72,0.72)" bottom={38} depth={14} par={par} />
      <Ridge d="M0,210 L160,158 L300,208 L460,146 L600,206 L740,150 L900,206 L1040,160 L1200,200 L1200,300 L0,300 Z"
             fill="#07060f" bottom={0} depth={22} par={par} />

      {/* Ground plane — converging lines give the vanishing point that tells
          the eye how far away the horizon is. */}
      <div className="absolute inset-x-0 bottom-0 h-[150px]" style={{
        perspective: '220px', perspectiveOrigin: '50% 0%', ...shift(6),
      }}>
        <div className="absolute inset-0" style={{
          transform: 'rotateX(72deg)', transformOrigin: '50% 0%',
          backgroundImage:
            'linear-gradient(to right, rgba(128,82,255,0.16) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(128,82,255,0.10) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage: 'linear-gradient(to bottom, #000 0%, transparent 72%)',
          WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, transparent 72%)',
        }} />
      </div>

      {/* ── The orrery ── */}
      {/* Two nested elements on purpose: the outer one owns responsive
          placement via Tailwind transform classes, the inner one owns the
          parallax transform. Putting both on one element would let the inline
          transform silently overwrite the classes. */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[92px] scale-[0.58] opacity-70
                   md:left-auto md:translate-x-0 md:right-[6%] md:top-[38px] md:scale-100 md:opacity-100"
      >
        <div style={{ perspective: '1000px', ...shift(-16) }}>
        <div className="relative" style={{ width: 300, height: 300, transformStyle: 'preserve-3d' }}>
          {orbits.map(o => (
            <OrbitRing key={o.label} orbit={o} reduced={reduced} />
          ))}
          {/* Core — today's score, the thing the whole instrument is measuring. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="absolute w-14 h-14 rounded-full"
              style={{
                background: `radial-gradient(closest-side, ${scoreColor(dayPct)}55, transparent 70%)`,
                filter: 'blur(6px)',
              }}
            />
            <span className="relative font-display text-title font-semibold tabular-nums text-on-surface leading-none">
              {dayPct ?? '—'}
              {dayPct != null && <span className="text-caption text-on-surface-variant/60">%</span>}
            </span>
            <span className="relative mt-1 text-micro font-bold uppercase tracking-[0.18em] text-on-surface-variant/45">
              Today
            </span>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

function Ridge({ d, fill, bottom, depth, par, blur }: {
  d: string; fill: string; bottom: number; depth: number
  par: { x: number; y: number }; blur?: number
}) {
  return (
    <svg
      viewBox="0 0 1200 300" preserveAspectRatio="none"
      className="absolute inset-x-0 w-full"
      style={{
        bottom, height: 300,
        filter: blur ? `blur(${blur}px)` : undefined,
        transform: `translate3d(${par.x * depth}px, ${par.y * depth * 0.4}px, 0)`,
      }}
    >
      <path d={d} fill={fill} />
    </svg>
  )
}

// One orbital plane. The wrapper owns the 3D tilt; the SVG inside draws the
// score arc, so the ring reports a real number instead of just spinning.
function OrbitRing({ orbit, reduced }: { orbit: Orbit; reduced: boolean }) {
  const { pct, size, tiltX, spinZ, period, reverse } = orbit
  const stroke = 2
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const has = pct != null && Number.isFinite(pct)
  const v = has ? Math.max(0, Math.min(100, pct)) : 0
  const col = scoreColor(pct)

  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{
        width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2,
        transform: `rotateX(${tiltX}deg) rotateZ(${spinZ}deg)`,
        transformStyle: 'preserve-3d',
      }}
    >
      <div
        className="w-full h-full"
        style={reduced ? undefined : {
          animation: `orrery-spin ${period}s linear infinite${reverse ? ' reverse' : ''}`,
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {/* Full orbit path, barely there */}
          <circle cx={size/2} cy={size/2} r={r} fill="none"
                  stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
          {/* Score arc */}
          {has && v > 0 && (
            <circle
              cx={size/2} cy={size/2} r={r} fill="none"
              stroke={col} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={`${c * (v / 100)} ${c}`}
              style={{ filter: `drop-shadow(0 0 5px ${col}88)` }}
            />
          )}
          {/* Body riding the orbit at its current value */}
          {has && (
            <circle
              cx={size / 2 + r * Math.cos((v / 100) * 2 * Math.PI)}
              cy={size / 2 + r * Math.sin((v / 100) * 2 * Math.PI)}
              r={3.5} fill={col}
              style={{ filter: `drop-shadow(0 0 6px ${col})` }}
            />
          )}
        </svg>
      </div>
    </div>
  )
}
