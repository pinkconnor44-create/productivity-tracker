'use client'
import { useEffect, useRef, useState } from 'react'
import { scoreColor } from '@/components/ui'

/**
 * CalendarHorizon — photographic backdrop + orrery for the calendar page.
 *
 * The first version drew the landscape as SVG polygons. It read as a cheap
 * vector illustration, because the quality being copied here is photographic:
 * real haze, grain and tonal subtlety are what make the reference feel
 * expensive, and flat fills cannot fake them at any level of tuning. So the
 * landscape is an actual image now, and this component's job is only to grade
 * it, scrim it, and park the orrery in it.
 *
 * DROP AN IMAGE AT: public/hero/calendar.jpg   (see public/hero/README.md)
 * If the file is absent nothing breaks — the background simply doesn't paint
 * and the bloom + orrery carry the page on black.
 *
 * LAYOUT CONTRACT — must stay a *sibling* of the calendar content, never an
 * ancestor. It establishes `perspective`, and any ancestor with
 * perspective/transform/filter becomes the containing block for
 * `position: fixed` descendants. DayModal is fixed and lives in that column.
 */

const HERO_SRC = '/hero/calendar.jpg'
/** How far down the page the photograph reaches before it is fully black. */
const SCENE_H = 720

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
  tiltX: number
  spinZ: number
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

  // Pointer parallax, desktop only — a finger dragging a phone is scrolling,
  // not aiming. rAF-coalesced so a fast mouse can't outrun paint.
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
          x: ((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2,
          y: ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2,
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

  const sceneStyle = { height: SCENE_H }

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden -z-[1]">
      {/* The photograph. Graded cool and dark to match the reference —
          distance drains saturation, and the scrim restores text contrast. */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          ...sceneStyle,
          backgroundImage: `url(${HERO_SRC})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 28%',
          filter: 'saturate(0.62) brightness(0.5) contrast(1.06)',
          transform: `scale(1.06) translate3d(${par.x * -10}px, ${par.y * -6}px, 0)`,
          transition: 'transform 400ms cubic-bezier(0.32,0.72,0,1)',
        }}
      />

      {/* Scrim. The reference always sits its photography under a dark overlay;
          this is what keeps the header and the calendar grid legible. */}
      <div className="absolute inset-x-0 top-0" style={{
        ...sceneStyle,
        background:
          'linear-gradient(to bottom, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.32) 16%, rgba(0,0,0,0.48) 42%, rgba(0,0,0,0.84) 68%, #000 92%)',
      }} />

      {/* Cool violet cast so the photo belongs to the Electric Iris palette
          instead of looking like a stock image dropped in. */}
      <div className="absolute inset-x-0 top-0 mix-blend-soft-light" style={{
        ...sceneStyle,
        background: 'linear-gradient(to bottom, rgba(128,82,255,0.40) 0%, rgba(90,70,190,0.18) 55%, transparent 100%)',
      }} />

      {/* Horizon bloom — the light the orrery reads against, and the only thing
          on screen until a photograph is supplied. */}
      <div className="absolute left-1/2" style={{
        top: 140, width: 1000, height: 320,
        background: 'radial-gradient(closest-side, rgba(168,150,255,0.24), rgba(110,86,200,0.08) 52%, transparent 100%)',
        transform: `translate3d(calc(-50% + ${par.x * 4}px), ${par.y * 2}px, 0)`,
      }} />

      {/* ── Orrery ── */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[96px] scale-[0.62] opacity-80
                   md:left-auto md:translate-x-0 md:right-[8%] md:top-[26px] md:scale-[0.98] md:opacity-100"
      >
        <div style={{
          perspective: '1000px',
          transform: `translate3d(${par.x * -18}px, ${par.y * -9}px, 0)`,
          transition: 'transform 400ms cubic-bezier(0.32,0.72,0,1)',
        }}>
          <div className="relative" style={{ width: 300, height: 300, transformStyle: 'preserve-3d' }}>
            {orbits.map(o => <OrbitRing key={o.label} orbit={o} reduced={reduced} />)}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="absolute w-14 h-14 rounded-full" style={{
                background: `radial-gradient(closest-side, ${scoreColor(dayPct)}55, transparent 70%)`,
                filter: 'blur(6px)',
              }} />
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

// One orbital plane. The wrapper owns the 3D tilt; the SVG draws the score arc,
// so each ring reports a real number instead of just spinning.
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
          <circle cx={size/2} cy={size/2} r={r} fill="none"
                  stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} />
          {has && v > 0 && (
            <circle cx={size/2} cy={size/2} r={r} fill="none"
                    stroke={col} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={`${c * (v / 100)} ${c}`}
                    style={{ filter: `drop-shadow(0 0 5px ${col}88)` }} />
          )}
          {has && (
            <circle
              cx={size / 2 + r * Math.cos((v / 100) * 2 * Math.PI)}
              cy={size / 2 + r * Math.sin((v / 100) * 2 * Math.PI)}
              r={3.5} fill={col}
              style={{ filter: `drop-shadow(0 0 6px ${col})` }} />
          )}
        </svg>
      </div>
    </div>
  )
}
