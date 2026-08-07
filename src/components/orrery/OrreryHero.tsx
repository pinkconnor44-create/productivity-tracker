'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { OrreryScores } from './Orrery3D'

// three + R3F is ~170 KB gzipped. It must never land in the initial bundle and
// must never be server-rendered, so it is a dynamic import with ssr:false and
// is only mounted once the gates below pass.
const Orrery3D = dynamic(() => import('./Orrery3D'), { ssr: false })

/**
 * OrreryHero — gating and chrome around the WebGL scene.
 *
 * Desktop only for now, and deliberately conservative about when it mounts:
 *  - fine pointer + >=1024px, so phones and tablets never pay for it
 *  - prefers-reduced-motion opts out entirely
 *  - IntersectionObserver, so nothing loads until the hero is actually on screen
 *  - the canvas is a SIBLING of the calendar content, never an ancestor —
 *    DayModal is position:fixed and lives in that column, and any ancestor with
 *    a transform or filter would become its containing block and break it.
 */
export default function OrreryHero(scores: OrreryScores) {
  const [ok, setOk] = useState(false)
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [node, setNode] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const wide = window.matchMedia('(min-width: 1024px)').matches
    const calm = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setOk(fine && wide && calm)
  }, [])

  useEffect(() => {
    if (!ok || !node) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } },
      { rootMargin: '150px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [ok, node])

  // Mount the canvas a frame after it becomes visible. IntersectionObserver can
  // fire before the container has been laid out, and R3F measures on mount — a
  // zero reading there leaves the canvas stuck at its 300x150 default.
  useEffect(() => {
    if (!visible) return
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [visible])

  // Measure here and hand the canvas an explicitly-sized parent, rather than
  // letting R3F measure a percentage-sized one. Its own measurement latched
  // zero at mount in this layout and only recovered on a window resize; a
  // ResizeObserver reading is taken after layout, so it is never zero.
  useEffect(() => {
    if (!node) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      const w = Math.round(width), h = Math.round(height)
      if (w > 0 && h > 0) {
        // Only replace state when the numbers actually change. A fresh object
        // on every callback churns identity, which re-runs the effect below and
        // clears its timeout before it can ever fire.
        setSize(prev => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
      }
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [node])

  // THE FIX, and the reason it has to live out here.
  //
  // Under Next 16 + Turbopack + React 19, R3F 9.7 latches a zero measurement of
  // its container on mount and never re-measures. That deadlocks: R3F does not
  // mount <Canvas> children until it has a non-zero size, so nothing *inside*
  // the scene can break it — a component calling setSize via useThree never
  // runs at all. Only a window resize event unblocks the observer, after which
  // it sizes correctly and stays correct.
  //
  // So: fire a short burst of resize events once the canvas is mounted. The
  // burst rather than a single shot because the exact frame R3F starts
  // listening is not deterministic. Verified: canvas goes 300x150 -> full size
  // and the scene paints.
  // Keyed on `ready && size` because that is the condition under which the
  // canvas is actually in the DOM — keying on `ready` alone fired the burst
  // before it existed. `size` keeps a stable identity (see the observer above),
  // so this does not re-fire on every observation.
  useEffect(() => {
    if (!ready || !size) return
    const timers = [0, 50, 150, 350, 700, 1200].map(ms =>
      setTimeout(() => window.dispatchEvent(new Event('resize')), ms))
    return () => timers.forEach(clearTimeout)
  }, [ready, size])

  if (!ok) return null

  return (
    <div
      ref={setNode}
      aria-hidden
      className="relative -mx-4 sm:-mx-6 mb-6 h-[380px] overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to bottom, #000 0%, #000 76%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 76%, transparent 100%)',
      }}
    >
      {/* Bloom behind the canvas, so the object sits in a lit space rather than
          on flat black even before WebGL paints. */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{
        width: 900, height: 460,
        background: 'radial-gradient(closest-side, rgba(128,82,255,0.22), rgba(90,66,190,0.07) 55%, transparent 100%)',
      }} />
      {ready && size && (
        <div className="absolute left-0 top-0" style={{ width: size.w, height: size.h }}>
          <Orrery3D {...scores} />
        </div>
      )}
      {/* Legend — the object is data, so say what it is reading. */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-5 pointer-events-none">
        {([['Year', '#8052ff'], ['Month', '#9b7bff'], ['Week', '#c9a4ff'], ['Day', '#ffb829']] as const).map(([l, c]) => (
          <span key={l} className="flex items-center gap-1.5 text-micro font-bold uppercase tracking-[0.16em] text-on-surface-variant/45">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}
