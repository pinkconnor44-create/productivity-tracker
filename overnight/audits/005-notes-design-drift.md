# 005 — `docs/DESIGN.md` describes a palette that was deleted; `docs/NOTES.md` has one contradicted line

**Verdict:** `DESIGN.md` is not terse — it is **wrong about almost every number
it states**, and it explicitly argues *against* the value `CLAUDE.md` mandates.
`NOTES.md` is broadly accurate and survived the health rework untouched (it
contains no health content at all), with **one** line contradicted by code.
`CLAUDE.md`'s four token claims are **all correct**. Two of `CLAUDE.md`'s health
claims are contradicted by `lib/health.ts`.

**Severity:** `risk` for `DESIGN.md` · `cleanup` for `NOTES.md` · `risk` for the
two `CLAUDE.md` health lines.
**Verified**, by reading both token sources end to end and grepping every call
site claimed. Not reasoned.
**Defect, not taste.** A doc that states a hex is either right or wrong.

---

## A. The `CLAUDE.md` claims I was asked to check — all four hold

| Claim (`CLAUDE.md`) | Source | Verdict |
|---|---|---|
| `.glass` is 62% opaque + 24px blur | `globals.css:225` `background: rgba(13, 13, 17, 0.62);` · `:229-230` `blur(24px) saturate(140%)` | ✅ |
| `primary-*` is Electric Iris `#8052ff` at 500 | `tailwind.config.ts:40` `500: '#8052ff'` | ✅ |
| `accent-*` is Saffron Spark | `tailwind.config.ts:48-49` `accent: { DEFAULT: '#ffb829' …}` (`--c-a-hex: #ffb829`, `globals.css:36`) | ✅ |
| Triad = Sleep Iris / Strain Saffron / Recovery green | `src/components/ui/metricColors.ts:17-20` — `strain #ffb829`, `recovery #4ade80`, `sleep #8052ff` | ✅ |
| rgb tuples stay space-separated | `globals.css:59-60` `--outline-rgb: 120 112 150;` / `--outline-variant-rgb: 84 80 108;`, consumed at `tailwind.config.ts:24-25` as `rgb(var(--outline-rgb) / <alpha-value>)` | ✅ |

Nuance on the last one, **not** a finding: `--c-p`, `--c-a`, `--success`,
`--warn`, `--danger`, `--info` *are* comma-separated (`globals.css:25, 34, 65-68`).
That is correct — they are only ever fed to `rgba()`, never to Tailwind — and
`tailwind.config.ts:30-32` documents exactly that split. The rule's blanket
phrasing ("The rgb tuples MUST stay space-separated") is looser than its own
rationale, but the rationale scopes it. Leave it.

---

## B. `docs/DESIGN.md` — the drift, quoted both ways

`CLAUDE.md` sends the reader here: *"Full spec in `docs/DESIGN.md`."* It is a
spec for the previous design system.

### 1. It contradicts the one glass number `CLAUDE.md` pins — twice, in bold

`docs/DESIGN.md:78`:
> Background: **92% opaque slate** (NOT 60% — over the aurora orbs + dot-grid bg, 60% reads as transparent)

`docs/DESIGN.md:183`:
> **Glass opacity:** `.glass` is 92% opaque, not 60%.

`src/app/globals.css:217-224`:
```css
/* Actually translucent now. This was rgba(23,31,51,0.92) — 92% opaque, so
   it paid for a 20px blur that showed essentially nothing. */
.glass { background: rgba(13, 13, 17, 0.62);
```
This is the worst instance in the repo: the doc does not merely lag, it
pre-argues against the current value, so anyone (or any agent) reconciling the
two "fixes" `.glass` back to 92% and silently reverts the design. Blur is
`20px` in the doc (`:79`, `:94`, `:146`) and `24px` in the file.

### 2. It documents the accent-theme switcher `CLAUDE.md` says was deleted

`docs/DESIGN.md:29-38`:
> 5 user-selectable accent themes via `[data-theme="X"]` on `<html>` … Persisted to `localStorage('accent-theme')`. Tailwind `violet-*` utilities are intercepted by `[data-theme]` overrides in `globals.css`

`src/app/globals.css:15`: *"The five-accent `[data-theme]` switcher is gone."*
`SettingsView.tsx:12-13`: *"The orphaned `localStorage('accent-theme')` key is
inert — nothing sets `data-theme` on the document any more."* Grepped all of
`src/`: **zero** `[data-theme]` selectors, **zero** `violet-*` utilities. The
default accent is quoted as `#8B5CF6`; the real anchor is `#8052ff`.

### 3. Every surface hex is wrong (7 of 7, plus both text tokens)

`docs/DESIGN.md:19-25` and `:44-45` vs `globals.css:41-49`:

| Token | DESIGN.md | globals.css | |
|---|---|---|---|
| `surface` | `#0b1326` | `#000000` | ✗ |
| `surface-container-lowest` | `#060e20` | `#030304` | ✗ |
| `surface-container-low` | `#131b2e` | `#08080b` | ✗ |
| `surface-container` | `#171f33` | `#0d0d11` | ✗ |
| `surface-container-high` | `#222a3d` | `#15151b` | ✗ |
| `surface-container-highest` | `#2d3449` | `#1d1d25` | ✗ |
| `surface-bright` | `#31394d` | `#26262e` | ✗ |
| `on-surface` | `#dae2fd` | `#ffffff` | ✗ |
| `on-surface-variant` | `#cbc3d7` | `#9a9a9a` | ✗ |

The doc's headline framing — *"near-black navy"*, *"Midnight Spectrum"*
(`:11-13`) — describes a navy ladder that is now pure black (`--surface: #000000`).
`CLAUDE.md` calls the palette "Void / Electric Iris".

### 4. It says the `!important` border block exists; it was deleted

`docs/DESIGN.md:49` and `:184`:
> `border-outline*` utilities are forced to dark accent shade via `!important` rules in `globals.css`. Tailwind's `/40` `/60` alpha modifier is bypassed; alpha is hardcoded per class.

`globals.css:52-58` twice refers to *"a since-deleted `!important` block"*, and
the whole point of the retuned `--outline-*-rgb` tuples is that
`border-outline-variant/40` (107 call sites) now honours the alpha modifier.
Following the doc's instruction — *"Add new alpha variants by appending to the
override block"* — means recreating the bug the tuples were retuned to fix.
Also: `outline` / `outline-variant` are documented as `var(--c-p)` (the accent);
they are `rgb(120 112 150)` / `rgb(84 80 108)`, deliberately neutral.

### 5. The type scale names nothing that exists

`docs/DESIGN.md:64-72` lists `headline-xl 64px`, `headline-lg 48px`,
`headline-md 32px`, `body-lg 18px`, `body-md 16px`, `label-sm 12px`.
`tailwind.config.ts:69-83` defines `micro / tiny / caption / body / body-lg /
title / headline / display-sm / display / metric / metric-lg`. **0 of 6
documented names resolve**, and the one shared name disagrees: `body-lg` is
16px in the config, 18px in the doc. `headline` is 24px, not 48.

### 6. The radius ladder is the *pre-fix* ladder

`docs/DESIGN.md:106-111` vs `tailwind.config.ts:113-121`: `DEFAULT` 0.5 → 0.375,
`md` 0.75 → 0.5, `lg` 1 → 0.75, `xl` 1.5 → 1; `2xl` (1.5rem, cards — 31 call
sites) and `3xl` are absent from the doc entirely. `tailwind.config.ts:102-112`
is a long comment about correcting exactly this inversion; the doc still records
the broken state, and `CLAUDE.md`'s "Cards `2xl`, StatCards `xl`" cannot be
checked against it.

### 7. Smaller contradictions, each verified

- **Gradient direction.** `:3` *"violet → blue gradient accent"*; `:132`
  *"Violet → blue gradient (135°)"*. `globals.css:32`: `--c-g-end: #ffb829;
  /* Saffron — violet-to-amber is the brand gradient */`, used by
  `.btn-primary` (`:271`) and `.gradient-text` (`:208`). Violet → **amber**.
- **Motion.** `:172` *"300ms cubic-bezier(0.4, 0, 0.2, 1) on all interactive
  elements"* — `globals.css:74-78` is `0.15s ease`, and `:90` is `150ms`.
- **`:173`** *"subtle 1.02x scale-up on `.neon-card` hover"* — `.neon-card:hover`
  (`globals.css:250-257`) applies `translateY(-2px)` and no `scale`.
- **`:135`** hover bloom `rgba(139,92,246,0.5)` at 20px — actual is
  `rgba(var(--c-p), 0.65)` at 25px plus a 50px second shadow (`:281`).
- **`:133-134`** `.btn-primary` *"0.5rem radius"* — it is `0.75rem` (`:273`).
- **`:139`** `.btn-ghost` hover *"`rgba(255,255,255,0.05)`"* — it is
  `rgba(var(--c-p), 0.08)` (`:306`).
- **`:158` Navigation** *"Top bar: floating glass … Pill indicator on primary
  tab bar animates via `tabRefs` + `getBoundingClientRect`"* — grepped `src/`:
  **no `tabRefs` anywhere**, and `.neon-pill` (`globals.css:261`) has **zero
  call sites**. The nav is a 240px sidebar + mobile drawer (`NOTES.md:8-9`).
- **`:121` Stack tokens** `stack-sm / stack-md / stack-lg` — **zero** matches in
  `src/`, `globals.css` and `tailwind.config.ts`. They do not exist.
- **`:117`** *"12-column grid"* — no grid system; `max-w-container` (1280px) has
  exactly one call site, in `Shell.tsx`.
- **`.btn-primary`, `.btn-ghost`, `.input-glass`** are documented in detail at
  `:129-155` and have **zero call sites in any component** — the only matches in
  `src/` are their own definitions in `globals.css`. `.input-glass` and
  `.btn-ghost` also still hardcode the deleted navy (`rgba(6,14,32,0.6)` =
  old `#060e20`; `rgba(23,31,51,0.4)` = old `#171f33`; placeholder
  `rgba(203,195,215,0.4)` = old `#cbc3d7`) — dead CSS carrying dead colours.

### What still holds in `DESIGN.md`

`:51` status tints (`bg-emerald-900/20` and `bg-emerald-50`: 0 matches, and 0
`dark:` prefixes repo-wide) · `:57-60` Space Grotesk + Manrope via
`next/font/google` (`layout.tsx:3-15`) · `:180` dark-only · `:181`
`hoverOnlyWhenSupported` (`tailwind.config.ts:5`) · `:182` the
transform-traps-`fixed` gotcha · `:117` max-width 1280px. **Six of ~40
statements.**

### What I tried to kill it with

- Assumed the doc was describing tokens that live somewhere else — no. Both
  files it names (`globals.css`, `tailwind.config.ts`) are the only definitions;
  there is no second theme file.
- Assumed the surface hexes were stale-but-harmless comments — no, they are the
  document's normative table, and `CLAUDE.md` calls it "the full spec".
- Assumed "92% opaque" might describe a different class — no, both mentions name
  `.glass` explicitly, and one of them pre-rejects the value now in the file.
- Checked whether the accent switcher survives anywhere (a `data-theme` on a
  sub-tree, an inert stylesheet) — grepped `src/` for `data-theme`, `violet-`
  and `accent-theme`: only the three comments recording the deletion.

**Fix (one line):** rewrite `docs/DESIGN.md` against `globals.css` +
`tailwind.config.ts` — or delete it and let `CLAUDE.md`'s token section stand
alone, rather than pointing at a "full spec" that is wrong in 7/7 surface hexes,
6/6 type names, 4/6 radii and the one glass value `CLAUDE.md` pins.
**Effort:** ~1–2h to rewrite honestly; ~5 min to delete it and drop the pointer.

---

## C. `docs/NOTES.md` — one contradicted line

The health rework did not touch it: `NOTES.md` covers Shell, CalendarView,
LiftTracker and ProjectsView only, and contains **no** health, Bevel-sub-tab or
import-pipeline claim to go stale. Spot-checked its named identifiers — all
present: `nav-order-v1`, `PRESS_MOVE_CANCEL`, `TAP_SLOP`, `data-no-swipe`,
`score-refresh`, `stopwatch-pos-v1`, `lift-draft-`, `shortTime`, z-index `55`/`60`.

**`docs/NOTES.md:16` is wrong:**
> The floating + docked stopwatch are gated on `activeTab === 'bevel'` (was `'lifts'`), so they show **across all Bevel sub-tabs, not just Lifts**. Deliberate — the plan called for tab-level gating.

`src/components/Shell.tsx:375`:
```jsx
{activeTab === 'bevel' && (liftsActive || running) && (
```
`src/lib/stopwatch.tsx:7`: *"`liftsActive` exists because the timer must be
VISIBLE only on the Lifts"* sub-tab. The `2026-08-09` change (`HANDOFF.md:157-163`,
commit `66292b4`) reversed exactly the behaviour this line defends, and the line
survived with its rationale intact — so it now reads as a deliberate decision
*against* the code. `Shell.tsx:370` carries the correct explanation four lines
above the gate.

**Severity** `cleanup`. **Verified.** **Defect** — it states the opposite of the
code and calls it deliberate.
**Fix (one line):** replace `NOTES.md:16` with "gated on `activeTab === 'bevel'`
**and** `liftsActive || running` — visible only on the Lifts sub-tab, except a
running timer, which is exempt." **Effort:** minutes.

---

## D. Two `CLAUDE.md` health rules are contradicted by `lib/health.ts`

Not the assigned files, but it is the same 2026-08-10 rework and the brief has
no finding on it, so recording it here rather than losing it.

1. **`CLAUDE.md`:** *"recovery scores the day's **minimum** heart rate — Apple's
   resting HR correlates with Bevel's recovery at the *wrong sign*."*
   `src/lib/health.ts:96-105`: *"Recovery is scored ENTIRELY on physiology
   measured inside last night's sleep window … The **old** model read whole-day
   HRV and the day's lowest heart rate."* `recoveryScore` (`:262-263`) weights
   `sleepHr` — the **mean** HR inside the sleep window — at `W_SLEEP_HR: 0.60`.
   The rule describes the model that was replaced.
2. **`CLAUDE.md`:** *"Recovery cannot fully match Bevel without sleep-window
   readings — no reweighting substitutes. See `RECOVERY_LIMIT`."*
   `src/lib/health.ts:154` opens *"The **old** limit, and how it was closed"*,
   and `:169` is now `RECOVERY_LIMIT = 'baseline history, not the input'`. The
   pointer resolves; the sentence it introduces is superseded.
3. Minor, same paragraph: `CLAUDE.md` lists three health tables
   (`HealthMetricDaily`, `SleepSession`, `HealthWorkout`).
   `prisma/schema.prisma:159` adds **`HealthSample`**, which is now the input to
   the whole pipeline (`HANDOFF.md:43-48`). Also *"calibrated against nine days …
   on 2026-08-09"* — `HANDOFF.md:77-84` refit on **ten** labelled days on
   2026-08-10, though `health.ts:73-74` still says nine/2026-08-09 too, so the
   code comment and `CLAUDE.md` are stale **together**.

**Severity** `risk` — these are the rules that exist to stop someone hand-tuning
the model, and two of them now misdescribe it.
**Fix (one line):** in `CLAUDE.md`, change "day's minimum heart rate" to
"sleep-window mean heart rate", replace the `RECOVERY_LIMIT` sentence with
"the residual gap is baseline history, not the input", and add `HealthSample` to
the table list. **Effort:** minutes.

---

## Not raised

- Nothing here duplicates brief findings 1–10 or the `## Rejected` list.
- The brief's *"Rule challenges: None … space-separated `rgb()` tuples [followed]
  without a single exception"* stands as written — see the nuance in §A.
- No gate was run for this item; it is a docs finding and proposes no code change.
