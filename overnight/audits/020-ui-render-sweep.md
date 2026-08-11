# 020 — UI render sweep: Bevel → Recovery, Bevel → Strain, `ImportStatus`, Bevel at 390px

_**Rendered.** `npm run dev` (Next 16.2.3 Turbopack, ready in 494 ms, port **3000**),
driven in Chrome via the extension. All four surfaces were opened and probed with
`getComputedStyle` / `getBoundingClientRect` per `dev\TRAPS.md` — nothing below is
"read from the CSS"._

_**Method note.** The browser window would not resize below ~950 CSS px, so
390 / 768 / 1440 were produced by a **same-origin iframe** on `localhost:3000`
whose width was set to each value — media queries, layout and computed styles
resolve against the iframe's own viewport, so the measurements are real. The
iframe was loaded at **900 px** first so `OrreryHero`'s one-shot `ok` gate
(`orrery/OrreryHero.tsx:29-34`, `[]` deps, `min-width:1024px`) latched **false**
and stayed false at 1440 — **the Calendar orrery never mounted; `canvas` count 0
throughout.** The Calendar tab itself was never opened._

_**No writes.** GETs only (`/api/health`, `/api/scores`, `/api/tasks`, …). No
checkbox, no delete, no PATCH/POST. Server log confirms: every request `GET`._

**Console: clean.** 11 messages across a full load + Bevel + Recovery + Strain,
all `[HMR] connected` / `[Fast Refresh]` / the React DevTools notice. **Zero
errors, zero warnings, zero hydration mismatches.**

---

## Surface-by-surface: did it render?

| Surface | 390 | 768 | 1440 | Horizontal overflow |
|---|---|---|---|---|
| Bevel → **Recovery** | ✅ | ✅ | ✅ | none — `documentElement.scrollWidth === clientWidth` = 390 / 768 / 1440 |
| Bevel → **Strain** | ✅ | ✅ | ✅ | none — same, 390 / 768 / 1440 |
| **`ImportStatus`** line | ✅ | ✅ | ✅ | n/a |
| Whole Bevel tab @ 390 | ✅ | — | — | none; the only elements past the viewport edge are inside `overflow-x-auto` (sub-tab strip `sw 407/cw 356`, day scroller `sw 5272/cw 270`) |

**Recovery's arithmetic is self-consistent on screen.** 2026-08-10: ring **73%**;
breakdown rows `Sleeping heart rate 88 · 60% weight`, `Sleeping HRV 53 · 35%`,
`Sleeping respiratory rate 44 · 5%`. `0.60×88 + 0.35×53 + 0.05×44 = 73.55 → 73`.
Matches `HEALTH_CONSTANTS.RECOVERY` (`lib/health.ts:104-106`). The "Locked at wake ·
from **103** readings during sleep" line renders and matches the API's
`sleepWindow.hrN`. `NoDayData` renders correctly for an unscored day
("No recovery score for Mon, Jul 20 · Pick another day above…").

**Ring:** 132×132 at all three widths, never clipped, never squashed.

---

## 1. Every `text-on-surface-variant/NN` class in the app is dead — the labels render **pure white**

**Verdict: defect, real, app-wide, one-line root cause.**
`tailwind.config.ts:22-23` · **severity: high (visual)** · **verified by measurement** ·
**defect** · fix ~30 min

```ts
'on-surface':         'var(--on-surface)',           // no <alpha-value>
'on-surface-variant': 'var(--on-surface-variant)',   // no <alpha-value>
```

`--on-surface-variant` is a **hex** (`globals.css:49`, `#9a9a9a`) and the token is
declared without an `<alpha-value>` placeholder, so Tailwind **refuses to emit the
opacity variants at all**. Exhaustive walk of every loaded stylesheet, including
nested rules:

```
rules whose selector contains "text-on-surface-variant":  2
  .text-on-surface-variant       { color: var(--on-surface-variant) }
  .hover\:text-on-surface-variant:hover { … }
rules for  .text-on-surface-variant\/NN :  0
```

Measured, live, on the Recovery panel:

| element | class | computed `color` |
|---|---|---|
| `Locked at wake · from 103 readings during sleep` | `text-micro text-on-surface-variant/45` | **`rgb(255, 255, 255)`** |
| `baseline 68ms` | `text-micro text-on-surface-variant/45 … truncate` | **`rgb(255, 255, 255)`** |
| `41.0bpm vs 45.1bpm baseline` | `text-micro text-on-surface-variant/45` | **`rgb(255, 255, 255)`** |
| `Last import 2 hours ago · 0 rows` | `text-micro text-on-surface-variant/55` | **`rgb(255, 255, 255)`** |

Control, same page, a token that *does* carry `<alpha-value>`
(`tailwind.config.ts:25`): `.border-outline-variant\/25` exists and computes
`rgba(84, 80, 108, 0.25)`. So the mechanism is confirmed, not inferred.

The declaration is dropped, `color` falls back to **inherited** = `--on-surface`
= `#ffffff`. Intent was ~45% of `#9a9a9a`; delivery is 100% white. **The entire
secondary-text tier of the design system is missing** — on Recovery every
"baseline …" note and every breakdown detail line sits at the same weight as the
metric name above it.

### It is not only text — two consequences are functional

- **`DayScroller.tsx:128`** — the presence dot is
  `bg-on-surface-variant/45`. Measured on eight consecutive chips:
  `backgroundColor: rgba(0, 0, 0, 0)` on **every one**. The dot is invisible for
  every day except the selected one (which uses `bg-primary-300` and works).
  `HANDOFF.md` states *"a day with no data is already a chip with no dot"* —
  in reality **no chip has a dot**, so the affordance that replaced the removed
  amber banner does not exist on screen.
- **`Shell.tsx:299`** sidebar `bg-surface/65` → measured `rgba(0,0,0,0)`;
  **`Shell.tsx:305`** mobile header `bg-surface/75` → measured `rgba(0,0,0,0)`.
  Both are sticky and rely on `backdrop-blur` alone; the intended tinted plate is
  absent. Same class of breakage, and `FloatingStopwatch.tsx:110` /
  `DockedStopwatch.tsx:22` (`bg-surface-container-high/95`) are floating panels
  with **no fill at all**.

### Blast radius

**240 dead utility classes across 38 files** (`grep -roh` on
`(text|bg|border|fill|stroke|ring|divide|from|to|via|shadow|placeholder|decoration|outline)-(on-surface…|surface…)/[0-9]+`),
of which **61 are in `components/bevel/` + `components/ui/`**. Top offenders:
`text-on-surface-variant/30` ×47, `/50` ×46, `/60` ×40, `/70` ×35, `/40` ×18,
`/55` ×17, `/45` ×16.

**Fix** (same shape the file already uses for `outline-variant`): add
`--on-surface-rgb: 255 255 255` and `--on-surface-variant-rgb: 154 154 154` (plus
the `surface*` tuples) to `globals.css`, then
`'on-surface-variant': 'rgb(var(--on-surface-variant-rgb) / <alpha-value>)'`.
⚠️ **Rendering will change on every screen at once** — this has been shipping
white for as long as the tokens have been hex, so the "before" everyone has seen
is the broken one. Worth a look-over after, not a blind merge.

`CLAUDE.md`'s rule *"The rgb tuples MUST stay space-separated … silently falls
back to white"* is **correct and was still violated**, because the rule polices
the tuple format and this token has no tuple at all. Worth widening the rule:
*a colour token that is ever used with a `/NN` modifier must be declared
`rgb(var(--x-rgb) / <alpha-value>)`.*

---

## 2. Trend-chart axis labels render at 3.2 px on a phone

**Verdict: defect, real, every chart in the app.**
`src/components/ui/TrendChart.tsx:116` (+ `:129`, `:134`, `:145`) ·
**severity: medium** · **verified by measurement** · **defect** · fix ~1 h

`<svg viewBox="0 0 1000 200" className="w-full">` with no intrinsic size, and the
labels use `fontSize="10"` in **user units**. Effective size = `10 × width/1000`.
Measured on Recovery's two trend charts:

| viewport | chart box (CSS px) | effective font-size | glyph box height |
|---|---|---|---|
| 390 | 316 × 63.2 | **3.16 px** | 4 px |
| 768 | 438 × 87.6 | **4.38 px** | 6 px |
| 1440 | 526 × 105.2 | **5.26 px** | 8 px |

Nothing is legible at any of the three. The y-axis values, the `JUL`/`AUG` ticks
and the `baseline` ref-line label are all decoration in practice. The 5:1 viewBox
also crushes the plot to **63 px tall at 390** — a 102-day series in 63 px.

Applies to Recovery ×2, Strain ×1, and every other `TrendChart` (Sleep, Trends,
Stats).

**Fix:** render axis text in CSS px, not user units — either give the `<svg>` a
fixed `height` and compute `x`/`y` against measured width, or set
`style={{fontSize:'10px'}}` with `vector-effect`-style non-scaling text via a
foreignObject/HTML overlay. Cheapest partial: raise the ratio (e.g.
`viewBox="0 0 1000 380"`) and bump `fontSize` to ~26 user units so it lands near
8–10 CSS px.

---

## 3. `MetricRow`'s label is cut in half between 768 px and 819 px — iPad portrait is exactly 768

**Verdict: defect, real, reproducible to the pixel.**
`src/components/ui/MetricRow.tsx:33-38` · **severity: medium** ·
**verified by measurement** · **defect** · fix ~30 min

The hero card goes horizontal at `sm:` (640), the desktop sidebar (240 px) appears
at `md:` (768), and `StatusChip` un-hides at `sm:`. Between those, the `min-w-0
flex-1` label column collapses. Swept `Sleeping heart rate` (needs **107 px**):

```
 760 → 287px  ok        790 →  77px  CLIPPED
 765 → 292px  ok        800 →  87px  CLIPPED
 770 →  57px  CLIPPED   810 →  97px  CLIPPED
 775 →  62px  CLIPPED   815 → 102px  CLIPPED
 780 →  67px  CLIPPED   820 → 107px  ok
```

**Clipped for every viewport width 768–819 inclusive.** At 768 the label column is
**57 px for a 107 px label**, so the card reads `Sleepin…` / `baseline 4…` /
`Sleepin…` / `baseline 5…` — screenshotted and confirmed. Four rows truncate at
once on Recovery.

The same `flex-1` is the wide-screen problem in reverse: at **1440 the label
column measures 727 px** for the same 107 px label, so the label and its value sit
~700 px apart across an unbounded card.

**Fix:** give the hero text column a `max-w-[520px]` (or `max-w-prose`) and let
`MetricRow`'s label be `flex-1 min-w-[9rem]`, so the chip and value shrink or wrap
before the label does.

---

## 4. Strain's "Daily load · last 21 days" ignores the selected day

**Verdict: defect, real, and it is the exact failure `HANDOFF.md` names as the
worst one available here.**
`src/components/bevel/BevelStrain.tsx:30` · **severity: medium** ·
**verified by driving the UI** · **defect** · fix ~20 min

```js
const recent = [...data.days].reverse().slice(0, 21)   // anchored on the DATA, not `selected`
```

Selected **Sun, Aug 2** in the day scroller. Measured `innerText` of the panel:

```
SUN, AUG 2                       ← hero, correct
WORKOUTS · SUN, AUG 2            ← correct
DAILY LOAD · LAST 21 DAYS
Tue, Jul 21          Mon, Aug 10 ← eight days AFTER the selected day
```

`HANDOFF.md` (2026-08-09 §1): *"A date picker whose header says one day while the
numbers come from another is the worst failure available here."* Every other
element on the tab resolves through `dayOf(selected)`; this strip does not.

Two smaller things in the same block:
- `BevelStrain.tsx:28` — `maxKcal` is the max of the **whole 102-day window**, so
  the 21 bars are scaled against a value that may be off-screen; a quiet 21 days
  renders as a flat row of stubs.
- `BevelStrain.tsx:113` — the only way to read a bar's value is the native
  `title=` tooltip. **There is no touch equivalent**, so on the phone the strip
  carries no numbers at all.

**Fix:** slice ending at `selected` — `days.filter(d => d.date <= selected).slice(-21)`
— and scale `maxKcal` over that slice.

---

## 5. `ImportStatus` renders **"Last import 2 hours ago · 0 rows"** — no source, no rows

**Verdict: defect (a gap), real, and it defeats the one question the line exists to
answer.**
`src/components/bevel/ImportStatus.tsx:66-68` vs
`src/app/api/health-import/route.ts:60-62` · **severity: medium** ·
**verified against live data** · **defect** · fix ~15 min

The live row, straight from `GET /api/health`:

```json
"lastImport": { "at":"2026-08-10T22:43:48.032Z", "ok":true,
                "metrics":0, "sleep":0, "workouts":0, "skipped":0,
                "span":null, "note":null, "source":"other" }
```

On screen, at all three widths: **`Last import 2 hours ago · 0 rows`**, green dot
(`bg-emerald-400`, measured `rgb(52,211,153)`). Not the
`· from phone · 22 rows` the review expected.

Two separate causes:

1. **`source: "other"` prints nothing.** `sourceOf()` (`route.ts:60-62`) returns
   `phone` / `backfill` / **`other`**; `ImportStatus` has a branch for the first
   two only. The `other` case is the *most* ambiguous one and renders identically
   to a row written before the column existed — which is precisely the "arrived
   and was turned away" vs "nothing arrived" ambiguity `TRAPS.md` says cost two
   days. `HANDOFF.md` next-step 1 hangs on this line saying "from phone"; with
   this row it never will.
2. **`0 rows` + `ok:true` renders as healthy green.** An import that wrote nothing
   is indistinguishable from a good one apart from the count, and the count is
   easy to skim past.

**Fix:** render `· from <source>` for every value (`· source: other`, or
`· unrecognised sender`), and treat `ok && rows === 0` as the amber state rather
than green.

Its own class `text-on-surface-variant/55` is also dead (finding 1) — the line
renders at 10 px **white**, so it is louder than the section headings around it.

---

## 6. Recovery cannot show a "calibrating" note, and imports the component that would

**Verdict: defect (missing affordance), real.**
`src/components/bevel/BevelRecovery.tsx:5` + `src/lib/health.ts:328-336` ·
**severity: low-medium** · **verified** · **defect** · fix ~45 min

`BevelRecovery.tsx:5` imports `CalibratingNote` and `seriesOf` and **uses
neither** — dead imports sitting next to the exact gap they would fill.
`BevelStrain.tsx:47-49` does show the note, because `Baseline` carries
`{ value, n, calibrating }` (`health.ts:177-204`). The `SleepWindow` type
(`health.ts:334-336`) exposes `hrBaseline / hrvBaseline / respBaseline` as **bare
numbers with no `n` and no `calibrating`**, so Recovery structurally cannot
render one.

This matters because `HANDOFF.md` records the sleep-window baselines as the
**entire remaining 16-point recovery gap** — "today's HRV baseline is a median
over 14 nights … Bevel compares against months". The UI shows `baseline 68ms` with
the same authority as a fully-settled baseline. Confirmed against live data:
`/api/health` returns a recovery score on **14 of 102 days** (2026-07-28 →
2026-08-10).

**Fix:** add `n` / `calibrating` to `SleepWindow` and render the imported
`CalibratingNote`; or delete the two dead imports if the decision is that it
should not show one.

---

## 7. Chart tooltips are mouse-only — the phone gets no numbers from any chart

**Verdict: defect, real, and it is a named `CLAUDE.md` / `TRAPS.md` rule.**
`src/components/ui/TrendChart.tsx:157-159` · **severity: medium** ·
**verified by reading + confirmed by the touch rule** · **defect** · fix ~1 h

```jsx
onMouseEnter={…} onMouseMove={…} onMouseLeave={…}   // no onTouchStart, no onPointerDown, no onFocus
```

`TRAPS.md`: *"Register both `mousedown` and `touchstart`"* and *"don't gate primary
actions behind hover"*. Combined with finding 2 (axis labels at 3.16 px at 390),
**every trend chart on a phone conveys shape only — not a single readable number.**
The `title=` bars in finding 4 have the same problem.

`ChartTip` itself is fine: it is `position: fixed` inside `.tab-fade`, but
`globals.css:162-164` runs a 0.22 s animation with **no `forwards`**, so no
transform is retained and no containing block is created once it settles. Checked,
not assumed — this one holds.

---

## 8. The Ring's outer glow is clipped at the ring's outer tangent

**Verdict: taste, cosmetic.**
`src/components/ui/Ring.tsx:32-33` + `:63` · **severity: low** ·
**verified by measurement** · **taste** · fix ~5 min

`w = round(132 × 0.085) = 11`, `r = (132−11)/2 = 60.5`, so the stroke's outer edge
is at **exactly 66 = size/2**, flush with the viewBox edge. The arc carries
`filter: drop-shadow(0 0 6px …)` (`:63`), and the root `<svg>` computes
`overflow: hidden` (measured). The 6 px halo is therefore cut off outside the
ring. Nothing is *missing* — the ring reads correctly — but the glow the code asks
for is not the glow that paints.

**Fix:** `r = (size - w)/2 - 6`, or drop an `overflow-visible` class on the `<svg>`.

---

## 9. Bevel sub-tab pills are 32 px tall at phone width

**Verdict: taste bordering on defect (touch target).** **severity: low** ·
**verified by measurement** · fix ~10 min

Measured at 390: sub-tab buttons `Dashboard 86×32`, `Sleep 56×32`,
`Recovery 79×32`, `Strain 59×32`, `Lifts 49×32`, `Trends 63×32`. Against Apple's
44×44 / Google's 48×48 minimum. The day-scroller chips are fine (`52×55`) and the
arrows are `36×59`.

The strip also scrolls horizontally at 390 (`scrollWidth 407 / clientWidth 356`)
with `Trends` cut mid-word and no scroll affordance — functional, but the sixth
sub-tab is discoverable only by swiping.

---

## Killed — checked and fine, do not raise

1. **"`↓ BELOW NORMAL` on a sleeping HR of 41 bpm reads as a warning while the
   breakdown scores it 88."** Not a bug. `StatusChip` is documented as
   *directional, not judgemental* and uses blue for both directions
   (`StatusChip.tsx:10-12`), and `MetricRow`'s delta is deliberately uncoloured
   (`MetricRow.tsx:23-26`). The reasoning is written down and correct.
2. **"`ChartTip` is `position: fixed` under the transformed `.tab-fade`."** See
   finding 7 — the animation has no `forwards`, so no containing block survives.
3. **"Recovery's weight-renormalisation and `Not counted` chip are broken."**
   **Unverifiable, not broken** — of the 14 days with a recovery score, **zero**
   have a partial sleep window (every one has all three of hr / hrv / resp). The
   `c.score == null` branch (`BevelRecovery.tsx:138-139`) and the renormalised-%
   path (`:131`) have **never rendered** and cannot be exercised against live
   data. Flagging as *unrendered*, not as a defect.
4. **Horizontal overflow.** None, at any of the three widths, on either tab.
5. **Console errors / hydration mismatches.** None.

## Also noticed (not scored)

- The PWA install banner is `fixed bottom-20 sm:bottom-6` and `<main>` has
  `padding-bottom: 0px` (measured). On the real tab the banner occupied
  `y 827–889` while `main` ended at `913` — it sits on top of the last card until
  dismissed. App-wide, not Bevel-specific.
- At 1440 the content column has no `max-width`, so the Strain hero puts the ring
  at x≈100 and `258 kcal` at x≈1400.
- The day scroller does not re-scroll the selected chip into view after a viewport
  width change (observed under programmatic resize; would show up on a phone
  rotate). Not reproduced on a real orientation change.
- `Chrome extension wedge:` one `Runtime.evaluate` timed out for ~90 s after a
  reload of the app tab, then recovered on its own. The Calendar tab was never
  open and `canvas` count was 0 at the time, so this was **not** the orrery.

## Verification ledger

| Claim | How |
|---|---|
| Recovery / Strain render at 390 / 768 / 1440 | opened, screenshotted, and measured at each width |
| No horizontal overflow | `documentElement.scrollWidth === clientWidth` at all three |
| `/NN` colour classes dead | walked every `CSSRule` in every loaded sheet; 0 matches; computed `color` = `rgb(255,255,255)` on 4 named elements; control class `border-outline-variant/25` present and correct |
| Presence dot invisible | `getComputedStyle(dot).backgroundColor === 'rgba(0, 0, 0, 0)'` on 8 chips |
| Axis text size | `getBoundingClientRect()` of the `<text>` node at each width |
| 768–819 clipping | `scrollWidth > clientWidth` swept in 5 px steps, 760→830 |
| Strain 21-day strip | selected Aug 2, read the panel's `innerText` |
| `ImportStatus` state | raw `GET /api/health` `lastImport` JSON + the rendered string |
| Orrery never mounted | `document.querySelectorAll('canvas').length === 0` throughout |
| No writes | dev-server log: every request `GET` |
