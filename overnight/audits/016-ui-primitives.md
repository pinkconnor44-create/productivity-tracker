# 016 — `src/components/ui/` primitives: dead exports and hand-rolled copies

_Verified 2026-08-10 by reading every file in `src/components/ui/` plus
`CalendarView`, `StatsView`, `HabitsView`, `TasksView`, `LiftTracker`,
`ProjectsView`, `Shell`, all ten `bevel/` files, `app/page.tsx`,
`tailwind.config.ts` and `globals.css`. No code changed. `tsc --noEmit` was
**not** run — nothing was edited, and none of the below is type-visible._

---

## (a) Dead primitives — **no, none.** `cleanup` · minutes

All 16 exported components have at least one JSX instantiation outside the
folder. Counted with `grep -rnoE "<Name(\s|/|>|$)"` over `src/`, excluding
`src/components/ui/`:

| Component | Uses | Component | Uses |
|---|---|---|---|
| `Section` | 21 | `Ring` | 5 |
| `StatCard` | 21 | `MetricRow` | 5 |
| `Card` | 20 | `KindChip` | 3 |
| `PageHeader` | 8 | `KindPicker` | 3 |
| `TrendChart` | 7 | `SegmentedControl` | 3 |
| `InsightCard` | 3 | `RangeGauge` | 2 |
| `SegmentedBar` | 2 | `RingCluster` | 1 |
| `StatusChip` | 1 | `ConfirmProvider` | 1 |

Four re-exported **symbols** are unused outside the folder, one unused entirely:

- `metricColor` (`ui/metricColors.ts:23`) — **zero references anywhere in
  `src/`**, including inside `ui/`. Two comments tell you to call it
  (`ui/index.ts:33` and `ui/Ring.tsx:12`); the six Bevel views instead read
  `METRIC_COLORS.<metric>.base` directly, 43 sites.
- `KIND_COLORS` / `KIND_LIST` (`ui/index.ts:12`) — consumed only by
  `ui/KindPicker.tsx:1`.
- `STATUS_STYLE` (`ui/index.ts:28`) — consumed only by `ui/StatusChip.tsx:1`.

**Verdict:** verified · taste · `cleanup` · minutes. Not worth a line in the
brief on its own; fold it into the fix below.

**Fix:** drop the four names from `ui/index.ts`; delete `metricColor` or call it
where the comments claim it is called.

---

## (b) The rule is broken — four score-colour ladders, four palettes

### Verdict · `risk` · verified · defect · ~1h

`src/components/ui/index.ts:34-39` is the canonical productivity traffic light:

```js
export function scoreColor(pct: number | null | undefined): string {
  const p = pct ?? 0
  if (p >= 75) return '#4ade80'
  if (p >= 50) return '#ffb829'
  return '#f43f5e'
}
```

Three views re-implement the same 75 / 50 thresholds with different colours.

**`src/components/CalendarView.tsx:72`**

```js
function wheelColor(pct: number) { return pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f43f5e' }
```

Same thresholds. Green is `#10b981` (emerald-500), not `#4ade80`. Amber is
`#f59e0b` (amber-500), not `#ffb829` (Saffron Spark, the declared second
accent). Only red matches.

**`src/components/StatsView.tsx:101-110`**

```js
if (p === 100) return 'bg-emerald-400'
if (p >= 75)  return 'bg-emerald-500/70'
if (p >= 50)  return 'bg-primary-500/70'
if (p >= 25)  return 'bg-amber-500/65'
return 'bg-rose-500/70'
```

Five bands instead of three, stock Tailwind hues instead of the palette, and
the 50–74 band is painted **`primary-500`, Electric Iris** — the brand colour
that means "selected / active" everywhere else in this app, used here to mean
"a middling day".

**`src/components/StatsView.tsx:257`** — inline literals `'#10b981'` / `'#f43f5e'`.

**`src/app/page.tsx:38-49`** — `wGreen` / `wYellow` / `wRed`, the gradients
`wheelGrad` (`CalendarView.tsx:71`) feeds the wheel arc. These *start* on
`scoreColor`'s hexes (`#4ade80`, `#ffb829`, `#f43f5e`) and end on
`#22c55e` / `#f5a300` / `#f5a300`. So the arc's first stop and the number
inside it are already two different greens **within one 64px wheel**.

### Proof of drift — all three pairs render at the same time

1. **`StatsView.tsx:256` and `:257` are adjacent `StatCard`s in one
   `grid-cols-4`.** 256 passes `color={scoreColor(todayScore?.pct)}` → `#4ade80`.
   257 passes `color={delta >= 0 ? '#10b981' : '#f43f5e'}`. Two green stat
   numbers, side by side, different greens.
2. **`StatsView.tsx:287` renders `WeekdayBars`** (bars filled
   `background: scoreColor(b.avg)`, `:65`) and **`:330` renders `YearHeatmap`**
   (`cellBg`, `:140`) on the same page. A 60% day is **Saffron amber** as a bar
   and **Iris purple** as a heatmap cell.
3. **`CalendarView.tsx:318-323`** renders the Day/Week/Month/Year `StatCard`
   strip with `scoreColor`; **`:339` → `:720` → `:742` → `:758`** renders
   `DayScoreWheel`'s percentage with `wheelColor`. In day view both are in the
   same viewport; the same score is `#4ade80` above and `#10b981` below.
   The month grid does it too — cells use `scoreColor` (`:457`), and the modal
   opened from a cell (`:1215`) shows the wheel.

### The token ladder the rule invokes exists and has zero consumers

`src/app/globals.css:64-68`:

```css
/* Status */
--success: 74, 222, 128;   /* = #4ade80 */
--warn:    255, 184, 41;   /* = #ffb829 */
--danger:  244, 63, 94;    /* = #f43f5e */
--info:    59, 130, 246;
```

`grep -rn -- "--success\|--warn\|--danger\|--info" src` returns **only these
declaration lines**. Nothing reads them. `scoreColor` hard-codes their exact
values as literals rather than referencing them, and the three forks hard-code
values that are not them at all. That is the precise failure the `CLAUDE.md`
rule describes: local copies that bypass the semantic token ladder.

`src/components/ui/index.ts:3` also carries its own violated rule — *"Do NOT add
inline raw hex here — it breaks accent theme switching"* — 31 lines above three
inline raw hexes. The rationale is stale too: `CLAUDE.md` records that the
accent-theme switcher was deleted.

**Fix (one line):** make `scoreColor` read `--success/--warn/--danger`, delete
`wheelColor`, and point `CalendarView:758`, `StatsView:101-110` and
`StatsView:257` at it.

**Effort:** ~1h — one function deleted, four call sites, one token wiring.
Decide first whether the heatmap keeps five bands (then it needs a
`scoreColorBand()` beside `scoreColor`, not a private ladder).

---

## `SegmentedControl` forked once, losing every ARIA role

### Verdict · `cleanup` · verified · defect · ~15 min

`src/components/CalendarView.tsx:295-307` vs `src/components/ui/SegmentedControl.tsx:26-50`.

Identical: `rounded-lg p-0.5 gap-0.5` trough, `px-3 py-1.5 rounded-md
font-semibold transition-colors` buttons, active
`bg-primary-500/16 text-primary-300 border border-primary-400/30`, inactive
`text-on-surface-variant/70 hover:text-on-surface`. `text-caption` is
`0.75rem` in `tailwind.config.ts`, i.e. byte-equivalent to the primitive's
`text-[12px]`.

Diverged:

| | `SegmentedControl` | `CalendarView:295` |
|---|---|---|
| trough | `bg-surface-container-low border border-outline-variant/40` | `glass` |
| a11y | `role="tablist"` + `aria-label` + `role="tab"` + `aria-selected` | none |
| overflow | `shrink-0` on buttons | absent |

So the Calendar's month/week/day switcher is a translucent blurred trough while
the visually identical Stats range picker (`StatsView.tsx:227`) and Bevel sub-tab
bar (`BevelView.tsx:93`) sit in a solid one — and only the Calendar one is
invisible to a screen reader as a tab set.

**Fix (one line):** replace `CalendarView:295-307` with
`<SegmentedControl options={…} value={view} onChange={setView} ariaLabel="Calendar view" />`.

---

## `WeightPicker` exists twice, hard-coding two off-palette hues

### Verdict · `cleanup` · verified · defect · ~30 min

`src/components/TasksView.tsx:109-128` and
`src/components/HabitsView.tsx:122-146` are the same component, down to the
class strings. Their constants are duplicated too: `W_LABEL` / `W_COLOR` at
`TasksView.tsx:27-28` and `HabitsView.tsx:22-23`, character-identical.

Both hard-code `bg-blue-500` and `bg-orange-500` (and `text-blue-500` /
`text-orange-500` in `W_COLOR`) — hues present in neither `primary` (Electric
Iris) nor `accent` (Saffron Spark) in `tailwind.config.ts:33-59`, and in no
token in `globals.css`.

They have **already drifted at the display end**, which is the tell that this is
a copy and not a shared thing: weight 2 renders as bare `text-blue-500` text in
`TasksView.tsx:283` / `:354` / `:441`, and as a bordered chip
`text-blue-300 bg-blue-500/15 border-blue-700/40` in `HabitsView.tsx:443-446`.
Same field, same value, two treatments.

This is the inverse of the stated rule — `ui/` does *not* provide a
`WeightPicker` — but it is the same harm, and the folder is where it belongs.

**Fix (one line):** move `WeightPicker` + `W_LABEL` + `W_COLOR` into
`src/components/ui/WeightPicker.tsx` on `accent-*` / `primary-*`, and import it
in both views.

---

## What I tried to kill and could not raise

- **27 sites writing `glass rounded-2xl border` instead of `<Card>`**
  (`TasksView.tsx:107`, `HabitsView.tsx:121`, `CalendarView.tsx` ×9,
  `ProjectsView.tsx` ×3, four Bevel headers, …) — **killed.**
  `globals.css:220-223` documents it as deliberate: *"No `!important` on the
  border, deliberately: 13 of the 15 `.glass` call sites carry a bare `border`
  utility with no colour, and Tailwind's preflight would otherwise paint them
  `#e5e7eb`. `.glass` (0,1,0) outranks preflight's `*` (0,0,0)."* The CSS was
  written around this pattern. Not drift.
- **Two hand-rolled area charts vs `TrendChart`** —
  `HabitsView.tsx:546-579` and `LiftTracker.tsx:604-640`, near-identical to each
  other. **Downgraded to taste, not raised.** `TrendChart` takes
  `{date, value}[]` and emits x-ticks only on month change; Habits labels per
  *week bucket* with a fixed `[0,50,100]` grid, Lifts labels per lift date with
  an auto domain and `k`-suffixed y-ticks. Migrating means adding props, not
  swapping a component. Critically, **neither has colour drift** — both already
  use `var(--c-p-hex)`, so the specific harm the rule guards against is absent.
- **`DayScoreWheel` (`CalendarView.tsx:742-764`) vs `Ring`** — **not raised as
  duplication.** `Ring` accepts `children`, so it could host the two-line
  centre, but the 900 ms `useWheelAnim` count-up (`:75`) and the `36×36`
  viewBox are genuinely its own. Only its *colour function* is the defect, and
  that is covered above.
- **Forked `Section` / `PageHeader` headers** — **killed.** Grepped
  `tracking-[0.14em|0.16em]` and `w-1.5 h-1.5 rounded-full` across all views;
  every hit is a `Ring` eyebrow, a status dot or a note marker, not a section
  header. `Section` has 21 uses in 8 files and no fork.

## Also noticed (not findings)

- `ui/index.ts:3` forbids inline raw hex "because it breaks accent theme
  switching"; the file contains three, and `CLAUDE.md` says the accent-theme
  switcher was deleted. One edit fixes both — the comment and the hexes.
- `BevelTrends.tsx:138` and `DayScroller.tsx:113` both hand-roll the
  `bg-primary-500/16 …` active pill for a *day chip*, not a segmented control.
  Two chip pickers, similar but not identical. Below the bar.
