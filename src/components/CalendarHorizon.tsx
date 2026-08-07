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
  /** Page title / controls, rendered over the scene rather than beneath it. */
  children?: React.ReactNode
}

// [x, y, r, opacity] — hand-placed so the field has clumps and voids like a
// real sky rather than the even spread a random generator produces.
const STARS: [number, number, number, number][] = [
  [64,38,1,0.55],[112,92,0.8,0.35],[150,26,1.2,0.7],[198,64,0.7,0.3],[243,18,1,0.5],
  [287,104,0.9,0.4],[331,52,1.3,0.75],[382,30,0.7,0.28],[425,86,1,0.45],[470,14,0.9,0.6],
  [516,68,0.7,0.3],[560,40,1.1,0.65],[604,96,0.8,0.35],[651,22,1,0.5],[695,72,0.7,0.26],
  [740,44,1.2,0.7],[788,16,0.8,0.4],[832,88,1,0.48],[876,34,0.7,0.3],[920,62,1.1,0.6],
  [966,20,0.9,0.42],[1010,98,0.8,0.34],[1054,46,1.2,0.68],[1098,26,0.7,0.3],[1142,78,1,0.5],
  [88,140,0.7,0.22],[300,150,0.8,0.25],[520,132,0.7,0.2],[760,146,0.8,0.24],[1000,136,0.7,0.2],
]

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

export default function CalendarHorizon({ dayPct, weekPct, monthPct, yearPct, children }: Props) {
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
    { label: 'Year',  pct: yearPct,  size: 300, tiltX: 80, spinZ: 0,   period: 150 },
    { label: 'Month', pct: monthPct, size: 236, tiltX: 60, spinZ: 34,  period: 104, reverse: true },
    { label: 'Week',  pct: weekPct,  size: 172, tiltX: 40, spinZ: -30, period: 72 },
    { label: 'Day',   pct: dayPct,   size: 112, tiltX: 14, spinZ: 16,  period: 46, reverse: true },
  ]

  // Distant things move least. That difference IS the depth.
  const shift = (depth: number) => ({
    transform: `translate3d(${par.x * depth}px, ${par.y * depth * 0.5}px, 0)`,
  })

  return (
    <div
      ref={ref}
      className="relative -mx-4 sm:-mx-6 mb-5 h-[300px] sm:h-[360px] overflow-hidden"
    >
      {/* Scene layers are inert; only the content overlay takes pointer events. */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{
        maskImage: 'linear-gradient(to bottom, #000 0%, #000 72%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 72%, transparent 100%)',
      }}>
      {/* Sky — blue hour. Deep indigo lifting to a violet band at the horizon. */}
      <div className="absolute inset-0" style={{
        background:
          'radial-gradient(130% 85% at 50% 98%, rgba(120,90,220,0.26) 0%, rgba(56,44,110,0.14) 40%, transparent 74%),' +
          'linear-gradient(to bottom, #000 0%, #03030c 32%, #07071c 60%, #0d0c28 84%, #131134 100%)',
      }} />

      {/* Stars. Cheap, and a night sky without them reads as a gradient. */}
      <div className="absolute inset-x-0 top-0 h-[62%]" style={shift(2)}>
        <svg viewBox="0 0 1200 240" preserveAspectRatio="none" className="w-full h-full">
          {STARS.map((st, i) => (
            <circle key={i} cx={st[0]} cy={st[1]} r={st[2]} fill="#fff" opacity={st[3]} />
          ))}
        </svg>
      </div>

      {/* Horizon glow — the light source the ridges are lit by. Sits ON the
          ridge line so the peaks read as backlit. */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{
        bottom: 74, width: 1000, height: 210,
        background: 'radial-gradient(closest-side, rgba(168,150,255,0.30), rgba(110,86,200,0.10) 52%, transparent 100%)',
        ...shift(3),
      }} />

      {/* ── Ridges, far to near ──────────────────────────────────────────
             Distant ranges sit HIGHER in frame, lighter and hazier; the
             foreground ridge sits lower and goes almost pure black. That
             ordering is what sells the distance. ── */}
      {/* Four ridges, far to near. Peak heights and spacing are deliberately
             irregular — evenly spaced peaks of equal height read as a sawtooth
             waveform, not a mountain range. The foreground is a smooth rolling
             curve rather than another jagged band, because mixing silhouette
             shapes is what stops the stack looking like one repeated motif.
             Colours are desaturated blue-grey, not saturated violet: distance
             drains colour, and the glow behind supplies the warmth. */}
      <Ridge h={140} bottom={70} depth={4}  par={par} blur={2.6}
             fill="rgba(154,152,196,0.26)"
             d="M0,150 L80,104 L128,126 L212,48 L268,90 L340,68 L420,26 L496,80 L560,58 L648,104 L724,54 L806,96 L884,72 L968,118 L1052,86 L1132,120 L1200,102 L1200,200 L0,200 Z" />
      <Ridge h={150} bottom={44} depth={9}  par={par} blur={1.3}
             fill="rgba(96,92,146,0.44)"
             d="M0,166 Q60,150 110,158 L190,96 L246,132 L322,110 L404,72 L470,120 L540,100 L622,146 L700,108 L780,140 L858,118 L940,156 L1024,126 L1110,152 L1200,134 L1200,200 L0,200 Z" />
      <Ridge h={152} bottom={18} depth={15} par={par}
             fill="rgba(44,42,78,0.88)"
             d="M0,178 L74,142 L156,172 L232,120 L318,158 L396,128 L486,166 L566,124 L654,162 L740,134 L828,174 L912,140 L1000,176 L1088,146 L1176,178 L1200,168 L1200,200 L0,200 Z" />
      <Ridge h={126} bottom={0}  depth={24} par={par}
             fill="#04040b"
             d="M0,172 Q140,146 262,166 Q382,184 500,156 Q622,130 742,158 Q862,184 980,160 Q1102,138 1200,164 L1200,200 L0,200 Z" />

      {/* Ground plane — converging lines give the vanishing point that tells
          the eye how far away the horizon is. */}
      <div className="absolute inset-x-0 bottom-0 h-[150px]" style={{
        perspective: '220px', perspectiveOrigin: '50% 0%', ...shift(6),
      }}>
        <div className="absolute inset-0" style={{
          transform: 'rotateX(72deg)', transformOrigin: '50% 0%',
          backgroundImage:
            'linear-gradient(to right, rgba(140,120,220,0.18) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(140,120,220,0.12) 1px, transparent 1px)',
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
        className="absolute left-1/2 -translate-x-1/2 top-[104px] scale-[0.62] opacity-80
                   md:left-auto md:translate-x-0 md:right-[9%] md:top-[34px] md:scale-[0.96] md:opacity-100"
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

      {/* Content rides on top of the scene — this is what makes it a hero
          rather than a backdrop the page sits in front of. */}
      <div className="relative z-10 px-4 sm:px-6 pt-5">{children}</div>
    </div>
  )
}

function Ridge({ d, fill, bottom, depth, par, blur, h }: {
  d: string; fill: string; bottom: number; depth: number; h: number
  par: { x: number; y: number }; blur?: number
}) {
  return (
    <svg
      viewBox="0 0 1200 200" preserveAspectRatio="none"
      className="absolute inset-x-0 w-full"
      style={{
        bottom, height: h,
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
