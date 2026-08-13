'use client'
import { useState } from 'react'
import { PageHeader, Card } from '@/components/ui'

// Diet planner — Bulk + Post-Bulk Cut. v2 (2026-08-12): research-grounded
// energetics. Still a pure calculator with NO persistence by design.
//
// THE MODEL, and where each number comes from:
//
// - Tissue energy densities (v2's core fix — v1 used 3,500 kcal/lb for
//   everything, which is the density of FAT ONLY):
//     fat        3,500 kcal/lb  (either direction)
//     muscle       700 kcal/lb  when LOST   (~70% water; Hall: FFM ≈ 1,000 kcal/kg)
//     muscle     2,000 kcal/lb  when GAINED (deposition + synthesis overhead;
//                               Slater 2019 ranges 6,050–7,440 kJ/kg plus
//                               training cost — the softest constant here)
//   The muscle/fat % keeps its v1 meaning — SHARE OF POUNDS — so a calorie
//   stream converts at the blended density λ·muscle + (1−λ)·fat.
//
// - Suggested partitioning (Forbes/Hall p-ratio): the lean fraction of a
//   weight change is ≈ 10.4 / (10.4 + fat-mass-kg). Loss-side suggestion is
//   derated ×0.5 for resistance training (this app's user lifts) and by
//   protein intake (Helms: 2.3–3.1 g/kg while cutting): <1.6 g/kg ×1.0,
//   1.6–2.29 ×0.75, ≥2.3 ×0.6. Gain-side uses the Forbes value directly.
//   Suggestions are hints with a tap-to-use — never auto-applied.
//
// - Metabolic adaptation (post-bulk cut only): the effective deficit decays
//   linearly to (100−A)% of entered by the end of the cut, so the average
//   deficit is D·(1−A/200). Literature: ~90–180 kcal/day typical, −240 to
//   −430 kcal/day at months 3–6 in controlled studies. Default 10%.
//
// - Unchanged from v1: 30-day months; fail days are an unknown-mix calorie
//   pool converted at fat density and excluded from the muscle/fat split;
//   the post-cut "fat to lose" auto-fills from bulk fat + fail-day pounds;
//   training-frequency derate shifts bulk-day partition from muscle to fat.

const FAT_KCAL_LB = 3500
const MUSCLE_LOSS_KCAL_LB = 700
const MUSCLE_GAIN_KCAL_LB = 2000
const FORBES_C_KG = 10.4
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
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** kcal per pound of a mixed gain/loss where λ = muscle share of the POUNDS. */
function blendedDensity(muscleFrac: number, gaining: boolean): number {
  const m = gaining ? MUSCLE_GAIN_KCAL_LB : MUSCLE_LOSS_KCAL_LB
  return muscleFrac * m + (1 - muscleFrac) * FAT_KCAL_LB
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

/** "suggested 12% · use" hint under a partition input. */
function Suggest({ pct, onUse }: { pct: number | null; onUse: (v: string) => void }) {
  if (pct === null) return null
  const v = (pct * 100).toFixed(0)
  return (
    <button
      onClick={() => onUse(v)}
      className="mt-1 text-micro text-primary-400/80 hover:text-primary-300 transition-colors"
    >
      suggested {v}% (Forbes p-ratio) · tap to use
    </button>
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
  // Profile (drives the Forbes suggestions; optional)
  const [bodyweight, setBodyweight] = useState('')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [proteinG, setProteinG] = useState('')
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
  const [adaptPct, setAdaptPct] = useState('10')
  const [fatTargetInput, setFatTargetInput] = useState('')
  const [fatTargetEdited, setFatTargetEdited] = useState(false)
  const [cutMusclePct, setCutMusclePct] = useState('')
  // Panels
  const [profileOpen, setProfileOpen] = useState(true)
  const [bulkOpen, setBulkOpen] = useState(true)
  const [cutOpen, setCutOpen] = useState(true)

  // ── Forbes suggestions ──
  const bwLb = toNum(bodyweight)
  const bfFrac = clamp(toNum(bodyFatPct), 0, 100) / 100
  const haveProfile = bodyweight !== '' && bodyFatPct !== '' && bwLb > 0
  const fatMassKg = bwLb * bfFrac * 0.45359237
  const forbesLean = haveProfile ? FORBES_C_KG / (FORBES_C_KG + fatMassKg) : null
  // Protein modifier for the loss side (Helms tiers, g/kg of bodyweight).
  const gPerKg = haveProfile && proteinG !== '' ? toNum(proteinG) / (bwLb * 0.45359237) : null
  const proteinMod = gPerKg === null ? 1.0 : gPerKg >= 2.3 ? 0.6 : gPerKg >= 1.6 ? 0.75 : 1.0
  // ×0.5: resistance-trained (this whole app assumes lifting).
  const suggestLoss = forbesLean !== null ? clamp(forbesLean * 0.5 * proteinMod, 0.05, 0.40) : null
  const suggestGain = forbesLean !== null ? clamp(forbesLean, 0.10, 0.60) : null

  // ── bulk maths (calorie streams → blended-density pounds) ──
  const trainFrac = clamp(trainPct !== '' ? toNum(trainPct) : 100, 0, 100) / 100
  const normalDaysPerMonth = Math.max(0, DAYS_IN_MONTH - toNum(failDays) - toNum(minicutDays))
  const normalTotal = normalDaysPerMonth * toNum(surplus)
  const monthlyNet = normalTotal + toNum(minicutTotal) + toNum(failTotal)
  const scale = toNum(planDays) / DAYS_IN_MONTH
  const normalCal = normalTotal * scale
  const minicutCal = toNum(minicutTotal) * scale
  const failCal = toNum(failTotal) * scale
  // Fail days: unknown-mix pool, fat density, excluded from the split (v1 rule).
  const failWeightLbs = failCal / FAT_KCAL_LB

  let bulkMuscleLbs: number | null = null
  let bulkFatLbs: number | null = null
  let normalWeightLbs = normalCal / FAT_KCAL_LB   // fallback when no % entered
  let minicutWeightLbs = minicutCal / FAT_KCAL_LB
  if (bulkMusclePct !== '') {
    // Training derate shifts the POUND share from muscle to fat, as in v1.
    const lam = clamp(toNum(bulkMusclePct), 0, 100) / 100 * trainFrac
    const density = blendedDensity(lam, normalCal >= 0)
    normalWeightLbs = normalCal / density
    bulkMuscleLbs = normalWeightLbs * lam
    bulkFatLbs = normalWeightLbs * (1 - lam)
    if (miniMusclePct !== '') {
      const lamM = clamp(toNum(miniMusclePct), 0, 100) / 100
      const densityM = blendedDensity(lamM, minicutCal >= 0)
      minicutWeightLbs = minicutCal / densityM
      bulkMuscleLbs += minicutWeightLbs * lamM
      bulkFatLbs += minicutWeightLbs * (1 - lamM)
    }
  }
  const totalWeightLbs = normalWeightLbs + minicutWeightLbs + failWeightLbs
  const minicutWarn = toNum(minicutDays) > 0 && miniMusclePct === ''

  // ── post-bulk cut maths ──
  const autoFatTarget = bulkFatLbs !== null ? Math.max(0, bulkFatLbs + failWeightLbs) : null
  const fatTargetStr = fatTargetEdited
    ? fatTargetInput
    : (fatTargetInput !== '' ? fatTargetInput : (autoFatTarget !== null ? autoFatTarget.toFixed(1) : ''))
  const fatTarget = toNum(fatTargetStr)

  let daysNeeded: number | null = null
  let muscleLost: number | null = null
  let totalLost: number | null = null
  let avgDeficit: number | null = null
  if (toNum(deficit) > 0 && fatTarget > 0 && cutMusclePct !== '' && toNum(cutMusclePct) < 100) {
    const lam = clamp(toNum(cutMusclePct), 0, 100) / 100
    // Adaptation: effective deficit decays linearly to (100−A)% by the end
    // of the cut, so the average is D·(1−A/200).
    const A = clamp(adaptPct !== '' ? toNum(adaptPct) : 0, 0, 50)
    avgDeficit = toNum(deficit) * (1 - A / 200)
    const density = blendedDensity(lam, false)
    const lbsPerDay = avgDeficit / density
    const fatPerDay = lbsPerDay * (1 - lam)
    daysNeeded = fatTarget / fatPerDay
    muscleLost = lbsPerDay * lam * daysNeeded
    totalLost = fatTarget + muscleLost
  }
  const netMuscle = bulkMuscleLbs !== null && muscleLost !== null ? bulkMuscleLbs - muscleLost : null

  const accentBulk = '#ffb829'
  const accentCut = 'rgb(74 222 128)'
  const accentProfile = '#8052ff'

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Diet" title="Bulk & post-bulk cut planner" />

      {/* ── Profile ─────────────────────────────────────────────────── */}
      <Card className="overflow-hidden" padding={0}>
        <PanelHeader dotClass="bg-primary-400" title="Profile" open={profileOpen} onToggle={() => setProfileOpen(o => !o)} />
        {profileOpen && (
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Bodyweight (lb)" value={bodyweight} onChange={setBodyweight} placeholder="e.g. 180" accent={accentProfile} />
              <Field label="Body fat %" value={bodyFatPct} onChange={setBodyFatPct} placeholder="e.g. 18" accent={accentProfile} />
              <Field label="Protein (g/day)" value={proteinG} onChange={setProteinG} placeholder="e.g. 160" accent={accentProfile} />
            </div>
            <div className="text-micro text-on-surface-variant/45 mt-2">
              {haveProfile
                ? <>Drives the suggested partitioning below (Forbes p-ratio, derated for lifting{gPerKg !== null ? ` · protein ${gPerKg.toFixed(1)} g/kg${gPerKg >= 2.3 ? ' — cut-protective' : gPerKg >= 1.6 ? ' — adequate' : ' — low for a cut (Helms: 2.3–3.1 g/kg)'}` : ''}).</>
                : 'Optional — fill in bodyweight + body fat % to get suggested muscle percentages instead of guessing.'}
            </div>
          </div>
        )}
      </Card>

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
              <div>
                <Field label="Muscle loss %" value={miniMusclePct} onChange={setMiniMusclePct} placeholder="e.g. 15" accent={accentBulk} />
                <Suggest pct={suggestLoss} onUse={setMiniMusclePct} />
              </div>
              <Field label="Fat loss % (auto)" value={miniMusclePct !== '' ? (100 - clamp(toNum(miniMusclePct), 0, 100)).toFixed(0) : ''} readOnly accent={accentBulk} />
            </div>

            <SectionLabel>Bulk partitioning</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Field label="Muscle gain %" value={bulkMusclePct} onChange={setBulkMusclePct} placeholder="e.g. 35" accent={accentBulk} />
                <Suggest pct={suggestGain} onUse={setBulkMusclePct} />
              </div>
              <Field label="Fat gain % (auto)" value={bulkMusclePct !== '' ? (100 - clamp(toNum(bulkMusclePct), 0, 100)).toFixed(0) : ''} readOnly accent={accentBulk} />
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
            <div className="text-micro text-on-surface-variant/40 mt-2">
              Muscle counted at {MUSCLE_GAIN_KCAL_LB.toLocaleString()} cal/lb to gain, {MUSCLE_LOSS_KCAL_LB} to lose; fat at {FAT_KCAL_LB.toLocaleString()}. Fail-day calories count toward total weight (as fat) but not the split.
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

            <SectionLabel>Metabolic adaptation</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Adaptation % by cut end" value={adaptPct} onChange={setAdaptPct} placeholder="10" accent={accentCut} />
            </div>
            <div className="text-micro text-on-surface-variant/45 mt-1.5">
              TDEE drifts down as a cut drags on (studies: ~90–430 cal/day). The effective deficit decays to {(100 - clamp(adaptPct !== '' ? toNum(adaptPct) : 0, 0, 50)).toFixed(0)}% of entered by the end{avgDeficit !== null ? ` — average ${Math.round(avgDeficit)} cal/day` : ''}. Set 0 to disable.
            </div>

            <SectionLabel>Partitioning</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Field label="Muscle loss %" value={cutMusclePct} onChange={setCutMusclePct} placeholder="e.g. 15" accent={accentCut} />
                <Suggest pct={suggestLoss} onUse={setCutMusclePct} />
              </div>
              <Field label="Fat loss % (auto)" value={cutMusclePct !== '' ? (100 - clamp(toNum(cutMusclePct), 0, 100)).toFixed(0) : ''} readOnly accent={accentCut} />
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
