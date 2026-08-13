'use client'

// The 1×/2×/3× weight selector, shared by TasksView and HabitsView — the two
// used to carry local forks that had already drifted (item 15). `hint` adds
// the one-line description under the row (the Habits form shows it; the Tasks
// form doesn't have the vertical room).

const LABELS = ['', 'Normal (×1)', 'Important (×2)', 'Critical (×3)']
const DESCRIPTIONS = [
  '',
  'Counts once toward daily score',
  'Counts twice toward daily score',
  'Counts three times toward daily score',
]

export function WeightPicker({
  value, onChange, hint = false,
}: { value: number; onChange: (w: number) => void; hint?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-tiny text-on-surface-variant font-medium">Weight</span>
        <div className="flex bg-surface-container-low rounded-lg p-0.5 gap-0.5">
          {[1, 2, 3].map(w => (
            <button key={w} type="button" onClick={() => onChange(w)} title={LABELS[w]}
              className={`w-6 h-5 rounded-md text-tiny font-bold transition-all ${
                value === w
                  ? w === 1 ? 'bg-surface-container text-on-surface-variant/70 shadow-sm'
                  : w === 2 ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-orange-500 text-white shadow-sm'
                  : 'text-on-surface-variant/30 hover:text-on-surface-variant/70'
              }`}>{w}</button>
          ))}
        </div>
      </div>
      {hint && <span className="text-micro text-on-surface-variant/30">{DESCRIPTIONS[value]}</span>}
    </div>
  )
}
