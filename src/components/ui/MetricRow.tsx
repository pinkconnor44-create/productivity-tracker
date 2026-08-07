import { ReactNode } from 'react'
import { StatusChip } from './StatusChip'
import { type MetricStatus } from './metricColors'

type Props = {
  label: ReactNode
  /** null renders the em-dash placeholder rather than a zero. */
  value: number | null | undefined
  unit?: string
  decimals?: number
  /** Percentage difference from the trailing baseline. */
  delta?: number | null
  status?: MetricStatus
  /** Shown under the label — usually the baseline it is being compared to. */
  sub?: ReactNode
  className?: string
}

// One metric as a list row: label + baseline note on the left, the reading and
// its delta on the right. Used down the Recovery and Sleep detail tabs where a
// grid of StatCards would be too heavy for a dozen values.
//
// The delta is intentionally uncoloured. Direction is not quality here — a
// resting heart rate 6% below baseline is good news and an HRV 6% below is
// not, and the row has no way to know which metric it is holding. Judgement
// belongs to the StatusChip, which is given it explicitly.
export function MetricRow({
  label, value, unit, decimals = 0, delta, status, sub, className = '',
}: Props) {
  const has = value != null && Number.isFinite(value)
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-outline-variant/25 last:border-0 ${className}`}>
      <div className="min-w-0 flex-1">
        <div className="text-caption font-medium text-on-surface truncate">{label}</div>
        {sub && <div className="text-micro text-on-surface-variant/45 mt-0.5 truncate">{sub}</div>}
      </div>

      {status && <StatusChip status={status} className="hidden sm:inline-flex" />}

      <div className="text-right shrink-0">
        <div className="font-display text-body-lg font-semibold tabular-nums leading-none">
          {has ? (
            <>
              <span className="text-on-surface">{(value as number).toFixed(decimals)}</span>
              {unit && <span className="text-tiny font-semibold text-on-surface-variant/50 ml-1">{unit}</span>}
            </>
          ) : (
            <span className="text-on-surface-variant/30">—</span>
          )}
        </div>
        {delta != null && Number.isFinite(delta) && (
          <div className="text-micro font-semibold text-on-surface-variant/50 tabular-nums mt-1">
            {delta > 0 ? '+' : ''}{delta}% vs baseline
          </div>
        )}
      </div>
    </div>
  )
}
