# HANDOFF — Productivity Tracker

> State only. Rules are in `CLAUDE.md`, component detail in `docs/NOTES.md`,
> cross-project traps in `dev\TRAPS.md`.

_Last updated: 2026-08-09 — **the phone automation finally works**; Bevel's
header and range picker replaced by a left-to-right day scroller; the rest
timer confined to Lifts; and sleep/strain/recovery calibrated against Bevel's
own scores. All committed, pushed and deployed to production._

## Current state

Merged to `main` and live at `productivity-tracker-murex.vercel.app`.
**Pushed to GitHub 2026-08-07** — the 28 commits that had never left this
machine, including the whole Bevel feature, are now backed up.

`feature/bevel-health` was merged with `--no-ff`, so **`git revert -m 1 1b0cc48`
undoes the entire feature in one step.**

- **Bevel phases 0–8 complete** — three additive Turso tables,
  `POST /api/health-import` (the app's only authed route), `GET /api/health`
  with trailing baselines and the three scores, six sub-tabs, backfill/seed/wipe
  scripts.
- **Lifts moved inside Bevel** — same component, same APIs, same tables; only
  its mount point changed.
- **Real data is in:** 1,708 metric rows, 62 nights, 11 workouts covering
  2026-05-09 → 2026-08-07. Baselines are full and no longer calibrating, so
  every score is meaningful — the "wait 30 days" caveat only applied to starting
  from empty, and the backfill removed it.
- Demo seed wiped. `HEALTH_IMPORT_KEY` is in `.env` and all three Vercel envs.

## 2026-08-09 — sync fixed, Bevel UI reworked, scores calibrated

Deployed and verified in production. No schema change anywhere, so **no
`db:push` was needed**. Commits `66292b4`, `9a5b4ee`, `2fea961`.

0. **✅ THE AUTOMATION WORKS.** First successful automated import at 14:33
   local: 14 metrics + 1 night, span 2026-08-09. See the resolved issue below.
1. **Bevel header and 30/90/365 picker removed; day scroller added.**
   (`bevel/DayScroller.tsx`, `BevelView.tsx`.) Every sub-tab except Trends
   renders exactly one day, so the top-level control is now a day, not a window
   length. The window is an implementation detail: 90 days on open, growing
   through 180/365/730 via a "More" chip only when the user scrolls that far
   back. Sub-tabs take a `selected` prop and resolve it with `dayOf` — which
   returns the selected day **or nothing**, and never silently falls back to an
   earlier day that happens to have readings. A date picker whose header says
   one day while the numbers come from another is the worst failure available
   here. Days with no data render `NoDayData` naming the day.
   - Also removed: the amber *"Showing Fri, Aug 7 — no readings have arrived
     for today yet"* line. Right when the day was picked *for* you, wrong the
     moment you pick it yourself. The scroller shows the selection, and a day
     with no data is already a chip with no dot.
   - **Direction: oldest LEFT, today RIGHT**, left arrow back, right arrow
     forward (`9a5b4ee`, Connor's call). The first cut ran newest-first to
     avoid a scroll-to-end on mount; that saved one effect and cost the
     reading direction every other chart in the app already uses.
2. **Rest timer confined to the Lifts sub-tab.** It was showing across all of
   Bevel. `liftsActive` now lives on the stopwatch context: BevelView sets it,
   Shell reads it. The overlays stay rendered by **Shell**, not BevelView,
   because `tab-fade` animates `transform` and would trap `position: fixed`
   inside the tab panel. A **running** timer is exempt from the gate — hiding a
   live count because you glanced at Recovery would lose the rest interval.
3. **Import log now records rejected requests** — the change that made the
   sync diagnosable. See `docs/BEVEL-OPEN-ISSUES.md` § 2026-08-09.
4. **Sleep, strain and recovery calibrated against Bevel** (`2fea961`) — see
   its own section below.

**Driven in Chrome against `npm run dev`** (the extension connected this time):
day selection changes every number on Dashboard and Sleep; a day with no data
shows the new empty state; the timer is present on Lifts and absent on
Dashboard; Trends hides the scroller. Console clean apart from a pre-existing
THREE.js shader precision warning from the calendar orrery. `npx tsc --noEmit`
and `npm run build` both clean.

## Verified — by running it

- **`scripts/test-health-import.mjs`, 26 checks** against a live server and the
  real Turso DB: 401 on wrong key, 400 on bad JSON, malformed points skipped
  without failing the batch, re-POST leaves row counts byte-identical, sleep
  hours → minutes, miles → km, workout duration derived from timestamps,
  unknown metrics preserved in `extra`.
- **The real export parsed correctly** — nothing skipped, sleep averaging 7.07h
  across a 4.04–9.35h range.
- **Day attribution confirmed against Apple Health by Connor.** Sleep for
  2026-08-04→07 matched exactly (6.8 / 7.1 / 8.6 / 7.6h). **This closes the
  highest-risk assumption in the whole pipeline** — `toLocalDay()` taking
  `slice(0,10)` of HAE's timestamp really is the phone's local day.
- **Auth against prod:** correct key → row counts; trailing-whitespace key →
  accepted; wrong key → 401; no key → 401.
- `npm run build` and `npx tsc --noEmit` clean; prod serves `data-tab="bevel"`
  and no longer serves Lifts.

## ⚠️ NOT verified

~~Nothing in the Bevel UI has ever been rendered.~~ **Partly closed
2026-08-09**: the Chrome extension connected for the first time, and Dashboard,
Sleep, Lifts and Trends were driven for real on desktop. Still unrendered:
**Recovery and Strain** (changed the same way, never opened), and the whole
Bevel tab at phone width — a 414px attempt was made and the extension wedged
before it rendered. The scoring change of `2fea961` was verified against the
live API over all nine days but **not re-eyeballed in a browser**; only
constants moved. `docs/BEVEL-QA.md` remains unrun as a checklist.

Also still outstanding from an earlier session: **Scratchpad checklist buttons
visible without hover** on the phone.

## ✅ RESOLVED 2026-08-09 — the phone automation

Three faults stacked, each masking the next, which is why it read as
unfixable for two days:

1. **HAE Premium was not active.** REST API automations are a paid feature; a
   free install shows the automation UI, reports success and never sends. This
   is why both the import log and Vercel's logs were empty.
2. **Wrong URL and method.** Once Premium unlocked it, HAE posted `GET /` and
   was rejected at Vercel's edge with **413** — `source: "static"`, so it never
   reached any of our code. Fixed by pointing it at the full path with POST.
3. **The API key never pasted** — it arrived as **1 character** against a
   64-character secret.

Nothing was ever wrong server-side: auth, parsing and the write path were
correct throughout. **The reason it sat parked was that a rejected request
wrote no log row**, so "nothing arrived" and "arrived and was turned away"
produced identical evidence. The fix was making the failure legible, not
changing any logic.

**The key was rotated** to a short typeable one (`.env`, all three Vercel
environments, and HAE) because Vercel stores env values encrypted and the only
plaintext copy was on a laptop Connor was away from. ⚠️ **That key is in the
2026-08-09 chat transcript** — rotate it again from the laptop and hand it over
out of band when convenient.

## 📊 Score calibration against Bevel — 2026-08-09

Connor supplied nine days of Bevel screenshots (2026-07-31 .. 08-09). Those
are the ground truth; **`scripts/fit-bevel.mjs` regenerates every constant in
`HEALTH_CONSTANTS` and prints the residuals.** This is a fit to observed
output, NOT a copy of Bevel's algorithm — that is not public.

Mean absolute error against Bevel, before → after:

| | before | after |
|---|---|---|
| sleep | 9.1 | **1.4** |
| strain | 24.4 | **3.8** |
| recovery | 20.1 | **6.7** |

Strain's 3.8 is **entirely 2026-08-07**, a partial-data day (81 active kcal is
not a real Saturday — it was the last day of the manual backfill). Excluding
it and 08-09, strain error is ~1.0.

- **Sleep is essentially a duration curve** with a knee below ~6.8h. The
  deep/REM terms were **removed**: across nine days they had no detectable
  effect on Bevel's number, so keeping them was fitting noise.
- **Strain is an absolute load scale**, not a percentile against personal
  history — Bevel's own copy says "Target Strain of 20-42%". The old
  baseline-relative model could not express that at any weighting.
- **Recovery's weights were already right.** The fit independently recovered
  0.50/0.30/0.20, the values already in the file. The INPUT was wrong.

### ⚠️ Recovery is still the one that is not matched, and why

Bevel scores on **sleep-window physiology**; this app has only daily
aggregates. Measured over the nine days:

    Bevel recovery vs Bevel's own sleeping HR : r = -0.81
    Bevel recovery vs our daily minimum HR    : r = -0.41
    Bevel recovery vs Apple's resting HR      : r = +0.39   (wrong sign)

Switching the input from Apple's resting HR to the **daily minimum** heart
rate and refitting the anchors took recovery from 20.1 to 6.7. The residual
sits exactly where the missing input bites: **2026-08-01** is off by 17
because Bevel saw a sleeping HR of **64.6** against a normal ~44 and scored
recovery **1**, while every daily aggregate we hold looked unremarkable.

**Closing it needs real sleep-window readings** — HRV and heart rate exported
at finer than daily aggregation, a `HealthSample` table keyed on timestamp,
and sleeping values compared against a **sleeping** baseline (comparing a
sleeping reading to a whole-day baseline would skew every score). Scoped, not
built; it also costs Connor one more HAE reconfiguration.

⚠️ **Nine points is not many.** Treat these constants as good-but-provisional
until there are ~20 days. Add rows to `BEVEL` in `scripts/fit-bevel.mjs` and
re-run before changing any of them by hand.

## Next steps

1. **Rotate `HEALTH_IMPORT_KEY` again** and update HAE — the current one is in
   a chat transcript. Not urgent, but it is a live credential.
2. **Feed more days into `scripts/fit-bevel.mjs`** as Bevel accumulates them,
   and re-run. Nine days is a thin fit.
3. **Sleep-window HRV / heart rate** — the only route left to matching
   recovery. Costs one HAE reconfiguration plus a `HealthSample` table.
4. **Device QA on the iPhone PWA** (`docs/BEVEL-QA.md`) — still unrun, and the
   day scroller has only ever been seen at desktop width.
5. **Delete `scripts/migrate-from-neon.mjs` and `npm uninstall pg @types/pg`.**
   The Neon project was to be decommissioned ~one week after 2026-05-09.
6. Ongoing data is hands-off now: hourly, upserts, gaps self-heal.

## Open questions

- Orrery tuning is open and cheap (`src/components/orrery/Orrery3D.tsx`).
  ⚠️ It also **wedges the Chrome extension** — script injection times out
  while the Calendar tab is mounted, which cost real time this session.
  Work around it by opening a fresh tab straight onto another view.
- Backlog, unstarted: per-screen depth / hero imagery — Connor, 2026-08-07,
  *"don't make it yet, keep it in mind."*
