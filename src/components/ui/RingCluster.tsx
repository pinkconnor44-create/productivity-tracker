'use client'
import { Ring } from './Ring'
import { METRIC_COLORS, type Metric } from './metricColors'

export type ClusterItem = {
  metric: Metric
  value: number | null
  /** Replaces the metric name under the ring. */
  label?: string
  sub?: string
  onClick?: () => void
}

type Props = {
  items: ClusterItem[]
  className?: string
}

// The Recovery / Sleep / Strain hero. Three equal rings on a wide screen; on a
// phone the first ring goes large and the rest sit beside it, because three
// rings shrunk to fit a 375px viewport are all too small to read.
//
// Each ring is coloured by its metric, never by scoreColor — a 20% Strain day
// is a rest day, and the productivity traffic light would paint it red.
export function RingCluster({ items, className = '' }: Props) {
  const [lead, ...rest] = items
  if (!lead) return null

  const ringFor = (i: ClusterItem, size: number) => {
    const c = METRIC_COLORS[i.metric]
    const inner = (
      <div className="flex flex-col items-center gap-2">
        <Ring pct={i.value} size={size} color={c.base} colorTo={c.from} />
        <div className="text-center">
          <div className="text-micro font-bold uppercase tracking-[0.14em] text-on-surface-variant/60">
            {i.label ?? i.metric}
          </div>
          {i.sub && <div className="text-micro text-on-surface-variant/40 mt-1">{i.sub}</div>}
        </div>
      </div>
    )
    return i.onClick ? (
      <button
        type="button"
        onClick={i.onClick}
        className="rounded-2xl p-1 -m-1 transition-transform active:scale-[0.97] md:hover:scale-[1.02]"
        aria-label={`${i.label ?? i.metric} detail`}
      >
        {inner}
      </button>
    ) : inner
  }

  return (
    <div className={className}>
      {/* Phone: one large + the remainder in a row beside it. */}
      <div className="flex sm:hidden items-center gap-5">
        {ringFor(lead, 116)}
        <div className="flex gap-5">{rest.map(i => <div key={i.metric}>{ringFor(i, 76)}</div>)}</div>
      </div>
      {/* Tablet and up: equal weight, evenly spread. */}
      <div className="hidden sm:flex items-center justify-around gap-6">
        {items.map(i => <div key={i.metric}>{ringFor(i, 124)}</div>)}
      </div>
    </div>
  )
}
