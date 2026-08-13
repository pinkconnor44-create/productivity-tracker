'use client'
import { useState } from 'react'
import { PageHeader, Card } from '@/components/ui'

// Diet planner — Bulk + Post-Bulk Cut (Connor, 2026-08-12). Ported from a
// standalone HTML calculator; the original's Cut panel was dropped on
// purpose. Pure calculator, NO persistence by design — numbers reset on
// reload, exactly like the original.
//
// Model notes, preserved from the source:
// - A month is 30 days; weight = calories / 3500.
// - Training-frequency derate applies ONLY to bulk normal days: untrained
//   days shift surplus calories from muscle to fat (adjMuscle = m·f,
//   adjFat = fat + m·(1−f)). Loss-side partitioning (mini-cuts, post-bulk
//   cut) uses the entered % raw — there is no equivalent mechanism for it.
// - Fail days are an unknown-mix calorie pool; when the post-bulk cut
//   auto-computes "fat to lose", the bulk's fail-day pounds are counted as
//   fat to be safe.

// Divide by 3500 directly — multiplying by a precomputed 1/3500 differs in
// the last floating-point bit, which flips .toFixed(1) at exact .x5
// boundaries (0.35 lb rendered 0.4 where the source calculator showed 0.3).
const CAL_PER_LB = 3500
const DAYS_IN_MONTH = 30

function toNum(s: string): number {
  const v = parseFloat(s)
  return isNaN(v) ? 0 : v
}
function fmtCal(n: number): string {
  return (n > 0 ? '+' : '') + Math.round(n).toLocaleString() + ' cal'
}
function fmtLbs(n: number): string {
  return (n > 0 ? '+' : '') + n.toFixed(1) + ' lb'
}

// ── shared UI bits ─────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, readOnly = false, accent }: {
  label: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  readOnly?: boolean
  accent: string
}) {
  return (
    <div>
      <label className="block text-micro font-bold uppercase tracking-[0.1em] text-on-surface-variant/45 mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={e => onChange?.(e.target.value)}
        inputMode="decimal"
        className={`w-full px-3 py-3 text-base rounded-xl border border-outline-variant/60 bg-surface-container-low text-on-surface placeholder-on-surface-variant/30 outline-none tabular-nums transition-colors ${readOnly ? 'text-on-surface-variant/60' : ''}`}
        onFocus={e => { if (!readOnly) e.currentTarget.style.borderColor = accent }}
        onBlur={e => { e.currentTarget.style.borderColor = '' }}
      />
    </div>
  )
}

function SectionLabel({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div className={`text-micro font-bold uppercase tracking-[0.12em] text-on-surface-variant/45 ${first ? '' : 'mt-5 pt-4 border-t border-outline-variant/30'} mb-2.5`}>
      {children}
    </div>
  )
}

function ResultRow({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1.5 border-b border-outline-variant/25 last:border-0 text-caption">
      <span className="text-on-surface-variant/55 shrink-0">{label}</span>
      <span className={`font-semibold tabular-nums text-right ${
        tone === 'pos' ? 'text-emerald-400' : tone === 'neg' ? 'text-rose-400' : 'text-on-surface'
      }`}>{value}</span>
    </div>
  )
}

function MiniStat({ num, label }: { num: string; label: string }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/40 px-3 py-2.5 text-center">
      <span className="block font-display text-body-lg font-bold tabular-nums text-on-surface break-words">{num}</span>
      <span className="block text-micro text-on-surface-variant/50 mt-0.5">{label}</span>
    </div>
  )
}

function PanelHeader({ dotClass, title, open, onToggle }: {
  dotClass: string; title: string; open: boolean; onToggle: () => void
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-2.5 px-5 py-4 text-left">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
      <span className="text-body-lg font-bold text-on-surface flex-1">{title}</span>
      <span className={`text-on-surface-variant/50 text-sm transition-transform ${open ? '' : '-rotate-90'}`}>▾</span>
    </button>
  )
}

// ── the view ───────────────────────────────────────────────────────────────

export default function DietView() {
  // Bulk inputs
  const [surplus, setSurplus] = useState('300')
  const [planDays, setPlanDays] = useState('120')
  const [failDays, setFailDays] = useState('2')
  const [failTotal, setFailTotal] = useState('3500')
  const [minicutDays, setMinicutDays] = useState('10')
  const [minicutTotal, setMinicutTotal] = useState('-3500')
  const [bulkMusclePct, setBulkMusclePct] = useState('')
  const [miniMusclePct, setMiniMusclePct] = useState('')
  const [trainPct, setTrainPct] = useState('')
  // Post-bulk cut inputs
  const [deficit, setDeficit] = useState('500')
  const [fatTargetInput, setFatTargetInput] = useState('')
  const [fatTargetEdited, setFatTargetEdited] = useState(false)
  const [cutMusclePct, setCutMusclePct] = useState('')
  // Panels
  const [bulkOpen, setBulkOpen] = useState(true)
  const [cutOpen, setCutOpen] = useState(true)

  // ── bulk maths ──
  const bulkFatPct = bulkMusclePct !== '' ? 100 - Math.min(100, Math.max(0, toNum(bulkMusclePct))) : null
  const miniFatPct = miniMusclePct !== '' ? 100 - Math.min(100, Math.max(0, toNum(miniMusclePct))) : null
  const trainFrac = Math.min(100, Math.max(0, trainPct !== '' ? toNum(trainPct) : 100)) / 100

  const normalDaysPerMonth = Math.max(0, DAYS_IN_MONTH - toNum(failDays) - toNum(minicutDays))
  const normalTotal = normalDaysPerMonth * toNum(surplus)
  const monthlyNet = normalTotal + toNum(minicutTotal) + toNum(failTotal)
  const scale = toNum(planDays) / DAYS_IN_MONTH
  const normalWeightLbs = (normalTotal * scale) / CAL_PER_LB
  const minicutWeightLbs = (toNum(minicutTotal) * scale) / CAL_PER_LB
  const failWeightLbs = (toNum(failTotal) * scale) / CAL_PER_LB
  const totalWeightLbs = (monthlyNet * scale) / CAL_PER_LB

  let bulkMuscleLbs: number | null = null
  let bulkFatLbs: number | null = null
  if (bulkMusclePct !== '' && bulkFatPct !== null) {
    const m = toNum(bulkMusclePct)
    const adjMuscle = m * trainFrac
    const adjFat = bulkFatPct + m * (1 - trainFrac)
    bulkMuscleLbs = normalWeightLbs * (adjMuscle / 100)
    bulkFatLbs = normalWeightLbs * (adjFat / 100)
    if (miniMusclePct !== '' && miniFatPct !== null) {
      bulkMuscleLbs += minicutWeightLbs * (toNum(miniMusclePct) / 100)
      bulkFatLbs += minicutWeightLbs * (miniFatPct / 100)
    }
  }
  const minicutWarn = toNum(minicutDays) > 0 && miniMusclePct === ''

  // ── post-bulk cut maths ──
  const autoFatTarget = bulkFatLbs !== null ? Math.max(0, bulkFatLbs + failWeightLbs) : null
  const fatTargetStr = fatTargetEdited
    ? fatTargetInput
    : (fatTargetInput !== '' ? fatTargetInput : (autoFatTarget !== null ? autoFatTarget.toFixed(1) : ''))
  const fatTarget = toNum(fatTargetStr)
  const cutFatPct = cutMusclePct !== '' ? 100 - Math.min(100, Math.max(0, toNum(cutMusclePct))) : null

  let daysNeeded: number | null = null
  let muscleLost: number | null = null
  let totalLost: number | null = null
  if (toNum(deficit) > 0 && fatTarget > 0 && cutMusclePct !== '' && cutFatPct !== null && cutFatPct > 0) {
    const fatPerDay = (toNum(deficit) * (cutFatPct / 100)) / CAL_PER_LB
    daysNeeded = fatTarget / fatPerDay
    muscleLost = ((toNum(deficit) * (toNum(cutMusclePct) / 100)) / CAL_PER_LB) * daysNeeded
    totalLost = fatTarget + muscleLost
  }
  const netMuscle = bulkMuscleLbs !== null && muscleLost !== null ? bulkMuscleLbs - muscleLost : null

  const accentBulk = '#ffb829'
  const accentCut = 'rgb(74 222 128)'

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Diet" title="Bulk & post-bulk cut planner" />

      {/* ── Bulk ─────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden" padding={0}>
        <PanelHeader dotClass="bg-accent-400" title="Bulk Plan" open={bulkOpen} onToggle={() => setBulkOpen(o => !o)} />
        {bulkOpen && (
          <div className="px-5 pb-5">
            <SectionLabel first>Basics</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Daily surplus (cal)" value={surplus} onChange={setSurplus} accent={accentBulk} />
              <Field label="Plan length (days)" value={planDays} onChange={setPlanDays} accent={accentBulk} />
            </div>

            <SectionLabel>Fail days (per month)</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fail days / month" value={failDays} onChange={setFailDays} accent={accentBulk} />
              <Field label="Total fail cal / month" value={failTotal} onChange={setFailTotal} accent={accentBulk} />
            </div>

            <SectionLabel>Mini-cuts (per month)</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mini-cut days / month" value={minicutDays} onChange={setMinicutDays} accent={accentBulk} />
              <Field label="Total mini-cut cal / month" value={minicutTotal} onChange={setMinicutTotal} accent={accentBulk} />
            </div>

            <SectionLabel>Mini-cut partitioning</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Muscle loss %" value={miniMusclePct} onChange={setMiniMusclePct} placeholder="e.g. 15" accent={accentBulk} />
              <Field label="Fat loss % (auto)" value={miniFatPct !== null ? miniFatPct.toFixed(0) : ''} readOnly accent={accentBulk} />
            </div>

            <SectionLabel>Bulk partitioning</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Muscle gain %" value={bulkMusclePct} onChange={setBulkMusclePct} placeholder="e.g. 35" accent={accentBulk} />
              <Field label="Fat gain % (auto)" value={bulkFatPct !== null ? bulkFatPct.toFixed(0) : ''} readOnly accent={accentBulk} />
            </div>

            <SectionLabel>Training frequency</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label="% of days trained" value={trainPct} onChange={setTrainPct} placeholder="e.g. 70" accent={accentBulk} />
            </div>

            <div className="bg-surface-container-low rounded-xl px-4 py-3.5 mt-5">
              <div className="text-micro font-bold uppercase tracking-[0.1em] text-on-surface-variant/45 mb-2">Monthly calorie balance</div>
              <ResultRow label="Normal days" value={`${normalDaysPerMonth.toFixed(0)} days @ ${fmtCal(toNum(surplus))}/day`} />
              <ResultRow label="Mini-cut cal / month" value={`${toNum(minicutDays).toFixed(0)} days = ${fmtCal(toNum(minicutTotal))}`} />
              <ResultRow label="Fail cal / month" value={`${toNum(failDays).toFixed(0)} days = ${fmtCal(toNum(failTotal))}`} />
              <ResultRow label="Net monthly balance" value={fmtCal(monthlyNet)} tone={monthlyNet >= 0 ? 'pos' : 'neg'} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-accent-400/25 bg-accent-400/10 px-4 py-3 mt-3">
              <span className="text-caption font-semibold text-on-surface-variant/70">Total weight change</span>
              <span className="font-display text-title font-bold tabular-nums text-on-surface">{fmtLbs(totalWeightLbs)} over {toNum(planDays)} days</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <MiniStat num={bulkMuscleLbs !== null ? `${bulkMuscleLbs.toFixed(3)} lb${minicutWarn ? ' ⚠' : ''}` : '—'} label={`Est. muscle gained${minicutWarn ? ' · mini-cut % missing' : ''}`} />
              <MiniStat num={bulkFatLbs !== null ? `${bulkFatLbs.toFixed(3)} lb${minicutWarn ? ' ⚠' : ''}` : '—'} label={`Est. fat gained${minicutWarn ? ' · mini-cut % missing' : ''}`} />
            </div>
          </div>
        )}
      </Card>

      {/* ── Post-bulk cut ───────────────────────────────────────────── */}
      <Card className="overflow-hidden" padding={0}>
        <PanelHeader dotClass="bg-emerald-400" title="Post-Bulk Cut" open={cutOpen} onToggle={() => setCutOpen(o => !o)} />
        {cutOpen && (
          <div className="px-5 pb-5">
            <SectionLabel first>Basics</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Daily deficit (cal)" value={deficit} onChange={setDeficit} accent={accentCut} />
              <Field label="Fat to lose (lb)" value={fatTargetStr}
                onChange={v => { setFatTargetInput(v); setFatTargetEdited(true) }} accent={accentCut} />
            </div>
            {!fatTargetEdited && autoFatTarget !== null && (
              <div className="text-micro text-on-surface-variant/45 mt-1.5">
                Auto-filled from the bulk above: fat gained + fail-day pounds. Type to override.
              </div>
            )}

            <SectionLabel>Partitioning</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Muscle loss %" value={cutMusclePct} onChange={setCutMusclePct} placeholder="e.g. 15" accent={accentCut} />
              <Field label="Fat loss % (auto)" value={cutFatPct !== null ? cutFatPct.toFixed(0) : ''} readOnly accent={accentCut} />
            </div>

            <div className="bg-surface-container-low rounded-xl px-4 py-3.5 mt-5">
              <div className="text-micro font-bold uppercase tracking-[0.1em] text-on-surface-variant/45 mb-2">Cut duration</div>
              <ResultRow label="Fat to lose" value={fatTarget > 0 ? `${fatTarget.toFixed(1)} lb` : '—'} />
              <ResultRow label="Days needed" value={daysNeeded !== null ? `${Math.ceil(daysNeeded)} days` : '—'} />
              <ResultRow label="≈ Weeks needed" value={daysNeeded !== null ? `${(daysNeeded / 7).toFixed(1)} weeks` : '—'} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 mt-3">
              <span className="text-caption font-semibold text-on-surface-variant/70">Total weight lost</span>
              <span className="font-display text-title font-bold tabular-nums text-on-surface">
                {totalLost !== null && daysNeeded !== null ? `−${totalLost.toFixed(1)} lb over ${Math.ceil(daysNeeded)} days` : '—'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <MiniStat num={fatTarget > 0 && daysNeeded !== null ? `−${fatTarget.toFixed(3)} lb` : '—'} label="Fat lost" />
              <MiniStat num={muscleLost !== null ? `−${muscleLost.toFixed(3)} lb` : '—'} label="Muscle lost" />
            </div>

            <div className="bg-surface-container-low rounded-xl px-4 py-3.5 mt-3">
              <div className="text-micro font-bold uppercase tracking-[0.1em] text-on-surface-variant/45 mb-2">Net result — full bulk → cut cycle</div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-caption font-semibold text-on-surface-variant/70">Net muscle after cutting all excess fat</span>
                <span className={`font-display text-title font-bold tabular-nums ${netMuscle !== null ? (netMuscle >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-on-surface-variant/40'}`}>
                  {netMuscle !== null ? `${netMuscle >= 0 ? '+' : ''}${netMuscle.toFixed(3)} lb` : '—'}
                </span>
              </div>
              {netMuscle !== null && bulkMuscleLbs !== null && muscleLost !== null && (
                <div className="text-tiny text-on-surface-variant/50 mt-2">
                  +{bulkMuscleLbs.toFixed(3)} lb gained in bulk − {muscleLost.toFixed(3)} lb lost re-cutting
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
