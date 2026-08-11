# 004 — `docs/BEVEL-QA.md`, the unrun device checklist

**Verdict:** `refined` — **20 of 24 steps still check the code that exists.**
The checklist did *not* rot the way the item assumed: the 2026-08-10 Recovery
rewrite invalidated **zero** steps. What is broken is the scaffolding around the
steps — the target URL, the demo-data preamble, and a destructive command the
doc tells you to run twice. Fix four lines, add two, then run it.

**Severity:** `risk` — one line of it (`docs/BEVEL-QA.md:61`) is a copy-paste
instruction that would delete real production health data, including the
sleep-window history `HANDOFF.md` names as the last open modelling gap. The rest
is `cleanup`.

**Verified** by reading every referenced component against every step, plus git
history and one HTTP HEAD. No gate was run — this is a doc-vs-code finding and
`tsc` cannot see it; `brief.md` already records `tsc --noEmit` clean.

**Defect**, not taste, in three places: `:6`, `:12-14`, `:60-62`. Taste in the
rest.

**File:** `docs/BEVEL-QA.md` — 68 lines, 24 checkboxes, last touched `b0687e1`
(2026-08-07). **Six commits have landed in `src/` since**, including the two
that rewrote the surfaces it tests.

---

## What actually moved under it

    $ git log --oneline -1 -- docs/BEVEL-QA.md
    b0687e1 Docs: Bevel in CLAUDE.md, the QA checklist, and the plan status
    $ git log --oneline --since=2026-08-07 -- src/
    5e72bfc  6c1d265  3d6672d  2fea961  9a5b4ee  66292b4

### The Recovery rewrite broke nothing in this checklist

The two steps covering Recovery are `:26` and `:27`:

| Step | Written 2026-08-07 for | Reads today | Status |
|---|---|---|---|
| `:26` "*'How this score was reached' shows three rows; weights sum sensibly; a row with no data reads 'Not counted'*" | daytime HRV / resting HR / sleep duration | `BevelRecovery.tsx:51-70` — still exactly **three** components (Sleeping HR 0.60, Sleeping HRV 0.35, Sleeping resp 0.05), still renormalised (`:131`), still renders a literal `Not counted` chip (`:139`) | **valid, unchanged wording** |
| `:27` "*Both range gauges show a marker, not just an empty track*" | HRV + resting-HR gauges | `BevelRecovery.tsx:113-122` — still exactly **two** `RangeGauge`s, now Sleeping HRV / Sleeping HR | **valid** |

The step text never named the quantities, so swapping the inputs left it
literally true. **The daytime readings did not disappear from the app either** —
`hrv` and `restingHr` are still Dashboard stat cards (`BevelDashboard.tsx:12`),
which is the only place the checklist would have met them, and it does not name
them there. The item's premise ("*any step describing the old Recovery UI is
likely stale*") is false: no step described it.

One genuine loss of coverage, though: `:26`/`:27` now pass while checking
nothing about what changed. Recovery is early-returned to `NoDayData` unless
`scores.recovery != null` (`BevelRecovery.tsx:36`), and `recoveryScore` returns
null when no component has both a reading and a baseline (`lib/health.ts:258`),
so the panel can never show three "Not counted" rows — the invariant the step
was written to catch is now structurally impossible. It is a free pass, not a
false alarm.

### Every other sub-tab step still resolves

| Step | Code | Status |
|---|---|---|
| `:18-19` one big ring + two small on phone | `ui/RingCluster.tsx:57-59` (`flex sm:hidden`, 116px lead + 76px rest) | valid |
| `:20` tapping a ring opens its sub-tab | `BevelDashboard.tsx:44-46` → `onOpen` | valid |
| `:21` stat grid 2 / 4 cols | `BevelDashboard.tsx:52` `grid-cols-2 sm:grid-cols-4` | valid (the break is `sm`, i.e. tablet, not "desktop") |
| `:23-24` four-segment stage bar, history scrolls in-card | `BevelSleep.tsx:58-67`, `:99` `max-h-[420px] overflow-y-auto` | valid |
| `:28` workout rows + 21-day bar history | `BevelStrain.tsx:98-121` (`recent = slice(0,21)`) | valid |
| `:29-30` Lifts identical; in-progress set survives a tab switch | `BevelView.tsx:64` seeds `visited` with `lifts`, panels stay mounted (`:119-120`) | valid — and this is the one step whose *mechanism* was rewritten, so it is worth more now than when written |
| `:31` Trends metric picker scrolls | `BevelTrends.tsx:89-95` `SegmentedControl scrollable` | valid |
| `:34` day-picker chips scroll, timeline follows | `BevelTrends.tsx:128-146` — Trends kept its **own** chip row when the global scroller arrived | valid, and no longer ambiguous |
| `:38-45` cross-cutting six (no h-scroll, nav shows Bevel not Lifts, tab swipe, long-press reorder, six sub-tabs, nothing hover-only) | `Shell.tsx:42,46,193,218,458-514`; `BevelView.tsx:26-35,93-99` | all six valid |
| `:53-54` Tasks/Habits/Stats/Projects render; Today widget | unchanged | valid |

**`:32` is the one step that now needs a caveat, not a rewrite:** "*Floating
stopwatch drags, and its position persists after a reload.*" Since `66292b4`
the overlay is gated to the Lifts sub-tab (`BevelView.tsx:74-77`,
`Shell.tsx:368-371`). Run on Dashboard it is legitimately absent, which reads as
a failed step.

## The four things that are actually wrong

1. **`:6` — the preview URL is a frozen 2026-08-07 build.** Vercel preview URLs
   are immutable per deployment; six `src/` commits have landed since. Running
   the list against it tests the pre-rework Bevel *against the current shared
   Turso database* — the exact "old code, new data" shape that `HANDOFF.md:15-20`
   records as having flattened a day's data once already. Confirmed still
   reachable and still protected:

       $ curl -sI ...466gt6m76... -o /dev/null -w "%{http_code} %{redirect_url}"
       302 https://vercel.com/sso-api?url=...

   Prod (`productivity-tracker-murex.vercel.app`) is live, unprotected, and
   running the code the steps describe.

2. **`:12-14` — "the tab currently shows ~75 days of **demo** data … It is not
   real."** Flatly false. `HANDOFF.md:130` — "Demo seed wiped"; `:127` — real
   data covers 2026-05-09 → 2026-08-10.

3. **`:60-62` — the doc hands you a destructive command, twice.**
   `node scripts/wipe-health-fixtures.mjs --yes` is `DELETE FROM` on
   `HealthMetricDaily`, `SleepSession`, `HealthWorkout`
   (`scripts/wipe-health-fixtures.mjs:13,33-35`) with no date filter and no
   "fixtures only" predicate — the name is the only thing scoping it, and the
   scoping stopped being true when the seed was wiped. It does **not** touch
   `HealthSample`, but the sleep-window means live on `SleepSession`
   (`prisma/schema.prisma:200-207`), so this erases the 2026-07-27 → 08-10
   sleep-window history that `HANDOFF.md:88-102` identifies as the whole
   remaining recovery gap. On a phone, on the shared prod DB, from a checklist
   whose preamble says the data is fake.

4. **`:51-52` — "*(this was the outstanding bug from the last session)*."** Two
   faults: a relative time reference, which `dev\CLAUDE.md` bans outright; and a
   dead claim. All three Scratchpad controls carry the touch-safe classes —
   `Scratchpad.tsx:257`, `:296`, `:301`, each `opacity-100 sm:opacity-0
   sm:group-hover:opacity-100`. This is a **second live copy** of the stale item
   `brief.md` finding 6 records in `HANDOFF.md:206-207`; fixing only the handoff
   leaves this one asserting the opposite.

## What it fails to cover

The two surfaces added after it was written, which are also the two least
exercised: **`DayScroller`** (`bevel/DayScroller.tsx`) and **`ImportStatus`**
(`bevel/ImportStatus.tsx`). Neither has a step. The scroller is now the primary
control on four of six sub-tabs, renders one 52px button **per day in the
window — 90 at open, up to 730** after two "More" taps (`BevelView.tsx:41`), and
mounts with a `scrollIntoView` (`DayScroller.tsx:52-54`). That is the single
most likely thing to misbehave at 375px, and it is the one thing `HANDOFF.md:204`
says has never been rendered at phone width.

## What I tried in order to kill it

1. **"Delete it, the code moved."** Fails — 20 of 24 steps verify against
   current source, line by line, above.
2. **"It is redundant with the browser QA already done."** Fails —
   `HANDOFF.md:199-204`: Recovery and Strain have never been opened in a browser
   at any width, and Bevel has never rendered on a phone at all. Nine of the
   eleven Bevel UI files are also unread by this review (`brief.md`, area E).
3. **"It is stale because of the Recovery rewrite"** (the item's own premise).
   Fails — see the table; the rewrite invalidated no step.
4. **"The wipe hazard is theoretical, prod has a backup."** Fails — Turso is
   shared across preview/prod/dev (`CLAUDE.md`), Resilio is explicitly not a
   backup (`dev\TRAPS.md:28`), and daily rows before 2026-07-27 exist only in
   that table plus a phone re-export.

## Fix

Repoint `:6` at prod, delete `:12-14` and the whole Empty-state block `:56-68`
(or replace the wipe with "check it on a fresh local DB"), drop the parenthetical
at `:52`, note that `:32` must be run on Lifts, and add two steps for the day
scroller and the import-status line.

**Effort:** ~20 minutes to edit. The checklist itself is then worth its ~30
minutes on the phone.

## Adjacent, not part of this item

- **`bevel/HealthEmptyState.tsx:19` tells the user to set HAE `Aggregate` to
  "Days".** Since 2026-08-10 the importer requires **Aggregate Data OFF** —
  raw samples with per-reading timestamps (`HANDOFF.md:44-48`). The onboarding
  screen now instructs the user into the exact configuration that caused
  "the automation was silently destroying every day's data". Checklist step
  `:64` ("the five numbered HAE setup steps") would pass while the steps are
  wrong. Not in `brief.md` or its Rejected list; area E is unread.
- **`CLAUDE.md`** repeats the same "*With Aggregate: Days*" premise under
  `toLocalDay()`, and still says "*Recovery cannot fully match Bevel without
  sleep-window readings — see `RECOVERY_LIMIT`*", while `lib/health.ts:169` now
  reads `RECOVERY_LIMIT = 'baseline history, not the input'` and
  `HANDOFF.md:74` says that limit is closed. Three live claims that disagree.
  `lib/health.ts:4-7`'s header still describes the old model too.
