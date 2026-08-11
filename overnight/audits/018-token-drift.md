# 018 — Design tokens: do the documented rules hold?

_Scope: `src/app/globals.css` (362 lines), `tailwind.config.ts` (129 lines),
`docs/DESIGN.md`, plus every consumer in `src/`. Read-only. `npx tsc --noEmit`
exit 0, no output._

**Headline: all five `CLAUDE.md` claims hold in the CSS. `docs/DESIGN.md` —
which `CLAUDE.md` names as "Full spec" — describes a different design system
and contradicts `CLAUDE.md` on the two rules it shares.**

---

## The five claims, one by one

### Claim 1 — every rgb tuple feeding a Tailwind colour is space-separated — ✅ HOLDS

**Verdict:** verified · **severity:** none · **verified, not reasoned**

Exactly two Tailwind colours use the `rgb(var(--x) / <alpha-value>)` form:

- `tailwind.config.ts:24` `outline: 'rgb(var(--outline-rgb) / <alpha-value>)'`
- `tailwind.config.ts:25` `'outline-variant': 'rgb(var(--outline-variant-rgb) / <alpha-value>)'`

Both feed from space-separated tuples — `globals.css:59` `--outline-rgb: 120 112 150`
and `globals.css:60` `--outline-variant-rgb: 84 80 108`. No commas.

The comma-separated tuples (`--c-p`, `--c-a`, `--c-glow`, `--success`, `--warn`,
`--danger`, `--info`) are **never** touched by Tailwind. Grepped every
`rgb(var(` / `rgba(var(` in the repo (30 call sites): all 28 non-config uses are
legacy `rgba(var(--x), 0.NN)`, which *requires* commas and is correct.
`tailwind.config.ts:30-32` carries the comment explaining exactly why `primary.DEFAULT`
is a plain hex rather than the `rgb(var(--c-p) / …)` form. This rule is not just
followed, it is understood at each site.

Cross-file: `CalendarView.tsx:949`, `Shell.tsx:394`, `TrendChart.tsx:128` all use
the comma form inside `rgba()`. Correct.

**Tried to kill it:** searched for any dynamically built colour string, any
`<alpha-value>` outside those two lines, and any component passing a
comma tuple into a slash context. None.

**Fix:** none needed. (Already recorded under the brief's *Rule challenges → None*.)

---

### Claim 2 — `.glass` is 62% opaque, 24px blur, prefixed-before-standard — ✅ HOLDS, with one dead counter-example

**Verdict:** verified · **severity:** none for `.glass`; `cleanup` for `.btn-ghost`
· **verified**

`globals.css:224-235`:
- `:225` `background: rgba(13, 13, 17, 0.62)` — 62% ✅
- `:229` `-webkit-backdrop-filter: blur(24px) saturate(140%)` — **first** ✅
- `:230` `backdrop-filter: blur(24px) saturate(140%)` — standard **last** ✅ 24px ✅

**But `globals.css:295-296` (`.btn-ghost`) declares them in the wrong order:**

```css
  backdrop-filter: blur(8px);          /* :295 — standard FIRST */
  -webkit-backdrop-filter: blur(8px);  /* :296 */
```

This is the exact `TRAPS.md` § CSS entry, inverted.

**Tried to kill it — and largely succeeded:** `.btn-ghost` has **0 call sites** in
`src/` (`grep -ro btn-ghost src` → 0). It is dead CSS, so nothing renders wrong
today. Severity is `cleanup`, not `risk`. It matters only as a copy-paste
template sitting three lines below a comment that says the opposite.

Every other blur in the app comes from Tailwind's `backdrop-blur-*` utilities
(11 sites), which emit the prefixed form first automatically.

**Defect or taste:** defect, unreachable.
**Fix (one line):** delete `.btn-ghost` (see claim 5b) or swap `:295` and `:296`.
**Effort:** minutes.

---

### Claim 3 — `primary-*` is Electric Iris `#8052ff@500`, `accent-*` is Saffron, no live `violet-*` — ✅ HOLDS (with a live second gold, below)

**Verdict:** verified · **severity:** none · **verified**

- `tailwind.config.ts:40` `500: '#8052ff'` ✅; `:34` `DEFAULT: '#8052ff'` ✅.
  The ramp is shaped as a 1:1 replacement for Tailwind's `violet-*` (11 shades),
  with the reasoning at `:26-29`.
- `tailwind.config.ts:48-60` `accent` = `#ffb829` DEFAULT / `#ffb829` at 400 ✅ Saffron.
- **`violet-` in `src/`: 0 live classes.** The only 3 hits are prose — `globals.css:18`
  and `:32` (comments), `SettingsView.tsx:7-8` (comment explaining the deletion).
  `primary-` has **217** uses.
- `data-theme` is set by nothing (`grep -rn data-theme src` → 3 comments only). The
  `accent-theme` localStorage key is confirmed inert at `SettingsView.tsx:12`.

**Tried to kill it:** grepped for `violet` in every extension, for dynamically
composed class names, and for the deleted `[data-theme]` override block. Clean.

---

### Claim 4 — background blooms are static — ✅ HOLDS

**Verdict:** verified · **severity:** none · **verified**

The only full-viewport backdrop layers are `.aurora-orb-{1,2,3}` and `.dot-grid`
(`page.tsx:31-34`, defined `globals.css:103-126` and `:191-199`). **Neither
declares `animation` or `transition` on any animatable property.** The
justification is written at `globals.css:96-102`.

Enumerated every remaining animation and checked whether it sits *behind* a
blurred surface:

| Animation | Site | Behind a `backdrop-filter`? |
|---|---|---|
| `streak-pulse` (infinite) | `Shell.tsx:323, 423` | No — inside the blurred header/sidebar, composited above it |
| `neon-pulse` (infinite) | `CalendarView.tsx:633, 667` | No — inside cards |
| `gradient-shift` (infinite) | `Shell.tsx:317` | No — inside the header |
| `burst-ring`, `tab-fade-in`, `cal-slide-*`, `toast-*` | one-shot | n/a |
| `animate-spin` / `animate-pulse` (7 sites) | small foreground glyphs | No |

Nothing animating is in the backdrop of a `.glass` panel (35 sites).

**Tried to kill it:** grepped `animate-(pulse|spin|ping|bounce)`, every
`@keyframes` name, and every `position: fixed` layer with `z-index: 0`. No
counter-example.

---

### Claim 5 — semantic type scale + radius ladder exist; `dark` hard-coded, no `dark:` variants — ✅ HOLDS

**Verdict:** verified · **severity:** none · **verified**

- **`dark:` in `src/`: 0 matches**, repo-wide. `layout.tsx:33` hard-codes
  `className={\`dark ${…}\`}` on `<html>`; `tailwind.config.ts:4` `darkMode: 'class'`.
  No `prefers-color-scheme` anywhere in `src/`.
- **Type scale** (`tailwind.config.ts:69-83`) is semantic and heavily used:
  `text-micro` 99 · `text-tiny` 69 · `text-caption` 18 · `text-body*` 11 ·
  `text-title` 4 · `text-headline` 1 · `text-display*` 6. **`text-metric*` 0** —
  declared for Bevel's ring centres (`:79-82`) and never adopted.
- **Radius ladder** (`:113-121`) ascends correctly, and the inversion described
  in the comment at `:104-112` is genuinely fixed: `Card.tsx:39` uses
  `rounded-2xl` (24px) and `StatCard.tsx:28` uses `rounded-xl` (16px), so the
  StatCard is now less round than its Card, as `CLAUDE.md` states.
  Uses: `lg` 66 · `xl` 52 · `2xl` 38 · `md` 29 · **`3xl` 0**.

---

## Findings raised

### T1. `docs/DESIGN.md` documents the design system that was deleted, and `CLAUDE.md` points at it as the spec — `risk` · ~2h · verified

`docs/DESIGN.md` (7,429 bytes) · last commit **`fd3a79e`, 2026-05-06** — i.e.
**before** `ab0160f` (2026-08-06) *"B-core: void black + Electric Iris; drop the
accent-theme system"*. It has not been touched since. `CLAUDE.md` line 71 says
*"Full spec in `docs/DESIGN.md`"*, so it is load-bearing by reference.

Every substantive value in it is now wrong:

| `DESIGN.md` says | Actual |
|---|---|
| `:19-25` surface ladder `#060e20 / #131b2e / #0b1326 / #171f33 / #222a3d / #2d3449 / #31394d` | `globals.css:40-47` — `#030304 / #08080b / #000000 / #0d0d11 / #15151b / #1d1d25 / #26262e`. **All 7 wrong.** |
| `:29-38` "5 user-selectable accent themes via `[data-theme]`", persisted to `localStorage('accent-theme')`, violet `#8B5CF6`, "`violet-*` utilities are intercepted by `[data-theme]` overrides" | Deleted. Nothing sets `data-theme`; the key is inert; `#8052ff` |
| `:3` "violet → blue gradient accent" | violet → **Saffron amber** (`globals.css:32`) |
| `:44-45` `on-surface` `#dae2fd`, `on-surface-variant` `#cbc3d7` | `#ffffff`, `#9a9a9a` |
| `:46-49` `outline*` = "`var(--c-p)` @ low alpha", forced by `!important` rules, *"Add new alpha variants by appending to the override block"* | The `!important` block is **deleted** (`globals.css:53-55` says so); outlines are neutral `120 112 150` / `84 80 108`. **This instructs the reader to edit a block that no longer exists.** |
| `:78, :93, :147, :183` `.glass` is **"92% opaque (NOT 60%)"**, `blur(20px)`, highlight white @ 20% | 62%, `blur(24px)`, white @ 6% |
| `:64-71` scale `headline-xl/lg/md`, `body-lg` 18px, `label-sm` | None of those tokens exist. The one shared name, `body-lg`, is **16px** |
| `:104-111` radius `DEFAULT .5 / md .75 / lg 1 / xl 1.5`, no `2xl` | `DEFAULT .375 / md .5 / lg .75 / xl 1 / 2xl 1.5 / 3xl 2` — **the whole ladder is off by one rung** |
| `:121` `stack-sm/md/lg` tokens | Do not exist |
| `:172` "300ms cubic-bezier(0.4,0,0.2,1) on all interactive elements" | `globals.css:74-78` — **0.15s ease**, explicit property list |
| `:174` ".neon-card hover: 1.02x scale-up" | `translateY(-2px)` only, no scale |
| `:135` btn-primary hover `rgba(139,92,246,0.5)` | `rgba(var(--c-p), 0.65)` |
| `:140` btn-ghost hover `rgba(255,255,255,0.05)` | `rgba(var(--c-p), 0.08)` |

Only three things survive: the `max-width: 1280px` container, and the three
*Gotchas* at `:180-182` (dark-only, `hoverOnlyWhenSupported`, the `transform`
stacking trap) — which `CLAUDE.md` already carries.

**This is a direct breach of the workspace doc rule "Supersede in place — never
leave two live claims that disagree."** `DESIGN.md:78` and `:183` say `.glass` is
92% opaque *and argue against 60%*; `CLAUDE.md` says 62%. Both are live, both are
cited as authoritative, and they contradict.

**Tried to kill it:** checked whether `DESIGN.md` is unreferenced dead weight —
it is not: `CLAUDE.md:71` cites it as the full spec, and `overnight/brief.md`
resume item **M** lists all four `docs/` files as still unread. Checked whether
the value tables might be aspirational — no, they are written as descriptions of
`globals.css` (`:13` "All values defined as CSS custom properties in
`src/app/globals.css`").

**Defect or taste:** defect. A spec that is confidently wrong is worse than no
spec — the next reader who "restores" 92% opacity or reinstates the `!important`
outline block reverses two deliberate fixes documented in `globals.css` itself.

**Fix (one line):** rewrite `docs/DESIGN.md` from the current `globals.css` +
`tailwind.config.ts` (or, cheaper today, delete it and drop the `CLAUDE.md:71`
reference until it is rewritten).
**Effort:** ~2h to rewrite, minutes to delete.

---

### T2. The `prefers-reduced-motion` block was added and deleted on the same day; a comment still points at it — `risk` · ~1h · verified via git

`globals.css:356-357` reads:

> *"Lives here rather than inline so the reduced-motion block at the top of this
> file can reach it."*

**There is no reduced-motion block in this file.** `grep -rn "prefers-reduced-motion"`
over `globals.css` → 0 hits.

Git history, `-S "prefers-reduced-motion"` on the file, shows exactly two commits:

- `a2d0da2` 2026-08-06 *"A2: honour prefers-reduced-motion; narrow the two blanket
  transition rules"* — **added** a `@media (prefers-reduced-motion: reduce)` block
  at old line 456, including `.aurora-orb { animation: none !important }` and
  `.dot-grid { animation: none !important; opacity: 0.6 }`.
- `ab0160f` 2026-08-06 *"B-core: void black + Electric Iris; drop the accent-theme
  system"* — **removed** it.

So a deliberate accessibility feature was collateral damage in the next commit,
the same day, and nobody noticed because the two orb rules it contained became
no-ops once the orbs stopped animating.

Consequence today: **three infinite animations run with no opt-out** —
`.streak-glow` (`globals.css:142-145`, 2.2s, `Shell.tsx:323, 423`), `.neon-pulse`
(`:343-345`, 1.6s, `CalendarView.tsx:633, 667`) and `.gradient-text`
(`:207-214`, 5s, `Shell.tsx:317`). The last two are in the persistent app chrome,
i.e. visible on every tab. The only surviving reduced-motion handling in the app
is JS, in `orrery/OrreryHero.tsx:32`.

**Tried to kill it:** searched for a reduced-motion block in any other stylesheet,
in `layout.tsx`, and in a Tailwind plugin. There is none — `plugins: []`
(`tailwind.config.ts:127`). Checked whether the three animations are gated in JS.
They are not.

**Defect or taste:** defect for the missing media query (it was intentional code,
silently lost); the stale comment is unambiguously wrong either way.

Note the deleted block used the blanket `transition-duration: 0.01ms !important`
form, which `TRAPS.md` § CSS explicitly warns against — so restoring it verbatim
would reintroduce a known trap. Target the three infinite animations instead.

**Fix (one line):** add `@media (prefers-reduced-motion: reduce) { .streak-glow,
.neon-pulse, .gradient-text { animation: none } }` and correct the comment at
`globals.css:356-357`.
**Effort:** ~1h including a browser check.

---

### T3. `accent-*` has zero class uses; the app paints Saffron with stock `amber-*`, a visibly different gold — `cleanup` · ~1h · verified

`tailwind.config.ts:48-60` declares a 10-shade Saffron Spark ramp.
**`grep -ro "accent-" src` → 1 hit, and it is the word `accent-theme` in a comment
(`SettingsView.tsx:12`).** No `bg-accent`, `text-accent`, `border-accent`, or any
`accent-N` class exists anywhere.

Where Saffron actually comes from:

- **Raw hex in TS** — `ui/metricColors.ts:17` `strain: { base: '#ffb829', from:
  '#ffcb5c', to: '#f5a300' }` and `ui/index.ts:37` `return '#ffb829'`. These are
  literally `accent-400 / accent-300 / accent-500`, retyped. Defensible: SVG
  gradient stops cannot take Tailwind classes.
- **Stock `amber-*` for chrome** — **63 uses**, e.g. `bevel/shared.tsx:178`
  `text-amber-400/80` and `bevel/ImportStatus.tsx:55` `bg-amber-400`.

`amber-400` is `#fbbf24`; `accent-400` is `#ffb829`. **Two different golds ship in
the same Bevel Strain view** — the SVG ring at `#ffb829` beside a label at
`#fbbf24`. Same story for `amber-300` `#fcd34d` vs `accent-300` `#ffcb5c`.

This is the practical failure of *"One curated palette"*: the Iris half of the
rule is enforced by the ramp being a drop-in for `violet-*` (217 uses, 0 escapes),
while the Saffron half has no such migration and the stock ramp filled the gap.

**Tried to kill it:** checked whether `amber-*` might be a deliberate separate
semantic (warning ≠ strain). It is not consistently so — `ImportStatus.tsx:55`
uses amber for "stale", which is a warning, but `shared.tsx:178` uses it inside
Strain, which is the brand accent. And `metricColors.ts:11` states the intent
outright: *"Strain in amber-gold, so the metric colours ARE the brand colours."*

**Defect or taste:** taste, at the ~2% colour-difference level — but it is the
exact kind of drift `CLAUDE.md` § *Design tokens* exists to prevent, and it is
invisible in review.

**Fix (one line):** sweep the 63 `amber-*` in `src/` to `accent-*` (a shade-mapped
rename), or delete the unused `accent` ramp and admit stock amber is the accent.
**Effort:** ~1h.

---

### T4. Dead CSS and dead tokens — `cleanup` · minutes · verified

Zero call sites in `src/`, all defined in `globals.css`:

| Rule | Lines | Uses |
|---|---|---|
| `.btn-primary` (+`:hover`,`:active`,`:disabled`) | `270-290` | **0** |
| `.btn-ghost` (+`:hover`) | `293-307` | **0** |
| `.input-glass` (+`::placeholder`,`:focus`) | `310-325` | **0** |
| `.neon-pill` | `261-267` | **0** |
| `@keyframes orrery-spin` | `358-361` | **0** |

`.neon-pill` is the interesting one: `Shell.tsx:393-394` hand-rolls the sliding
tab pill inline (`background: 'linear-gradient(135deg, var(--c-p-hex),
var(--c-g-mid))'`, `boxShadow: '0 0 16px rgba(var(--c-p), 0.4)'`) rather than
using the class written for it — so the pill glow in `globals.css:262-265` (14px
+ 28px + inset) and the one that ships (16px) have already diverged.
`orrery-spin` carries a comment explaining it lives in this file *"so the
reduced-motion block at the top of this file can reach it"* — a keyframe nothing
uses, justified by a block that no longer exists (see T2).

Custom properties declared and never read anywhere in the repo:
`--c-p-lt` (`:28`), `--c-p-dk` (`:29`), `--c-a-hex` (`:36`), `--success` (`:65`),
`--warn` (`:66`), `--danger` (`:67`), `--info` (`:68`). `--c-glow` (`:30`) is
byte-identical to `--c-p` (`:27`) and used once (`:134`).
`--outline` (`:50`) and `--outline-variant` (`:51`) are read **only** by
`.btn-ghost` and `.input-glass`, both dead — so they die with them, leaving
`--outline-rgb` / `--outline-variant-rgb` as the live pair.

Tailwind tokens declared with 0 uses: `surface-dim`, `surface-bright`,
`secondary`, `secondary-container` (config `:15-16, 61-62`), `shadow-glow`,
`shadow-glow-lg`, `shadow-dot` (`:89-92`), `text-metric`, `text-metric-lg`
(`:81-82`), `rounded-3xl` (`:120`).

**Tried to kill it:** checked for dynamically composed class names
(`` `btn-${variant}` `` etc.) across `src/` — none; all class strings are literal
or come from `clsx`-style literal arrays. Checked `public/sw.js` and
`api/pwa-icon` for CSS strings — none.

**Defect or taste:** taste. Note the `.btn-*` / `.input-glass` set is what
`docs/DESIGN.md:129-154` documents as the button and input system — so the spec's
component section describes four classes the app does not use, on top of T1.

**Fix (one line):** delete the five rules and the seven orphan properties; leave
the Tailwind tokens (they are cheap and `text-metric` is a stated intent).
**Effort:** minutes.

---

### T5. `plan.md:77` still tells the reader to use `violet-*` — `cleanup` · minutes · verified

`plan.md:77`: *"Follow repo conventions: dark-only, violet-\* for accent, portal
tooltips inside `.neon-card`, mousedown+touchstart, no hover-gated actions on
touch."*

Four of the five are current. `violet-*` is the one thing `CLAUDE.md` says never
to use, and this is the only file in the repo that instructs someone to use it.
`plan.md` was last touched `b0687e1` 2026-08-07 *"Docs: Bevel in CLAUDE.md, the QA
checklist, and the plan status"* — recent enough that a reader will trust it.

**Fix (one line):** `violet-*` → `primary-*` in `plan.md:77`.
**Effort:** minutes.

---

## Summary

| # | Item | Severity | Effort |
|---|---|---|---|
| Claim 1 | space-separated rgb tuples | **holds** | — |
| Claim 2 | `.glass` 62% / 24px / prefixed-first | **holds** | — |
| Claim 3 | `primary-*` Iris, `accent-*` Saffron, no `violet-*` | **holds** | — |
| Claim 4 | blooms static | **holds** | — |
| Claim 5 | semantic scale + ladder, `dark` hard-coded, no `dark:` | **holds** | — |
| T1 | `docs/DESIGN.md` documents the deleted design system | `risk` | ~2h |
| T2 | reduced-motion block added then deleted; stale comment | `risk` | ~1h |
| T3 | `accent-*` unused; Saffron ships as stock `amber-*` | `cleanup` | ~1h |
| T4 | 5 dead rules, 7 orphan custom properties | `cleanup` | minutes |
| T5 | `plan.md:77` says use `violet-*` | `cleanup` | minutes |

**Zero bugs. The CSS is disciplined; the documentation about it is not.** The
rules that `globals.css` writes down *in its own comments* (`:53-58` on tuples,
`:96-102` on static blooms, `:226-228` on prefix order, `:104-112` on the radius
ladder) are all obeyed at every site. The two things that drifted are both files
nobody edits while working in the CSS: `docs/DESIGN.md`, untouched since
2026-05-06, and a reduced-motion block that survived one commit.

**Gate run:** `npx tsc --noEmit` → exit 0, no output.
