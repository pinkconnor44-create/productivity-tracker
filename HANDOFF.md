# HANDOFF — Productivity Tracker

> State only. Rules are in `CLAUDE.md`, component detail in `docs/NOTES.md`,
> cross-project traps in `dev\TRAPS.md`.

_Last updated: 2026-08-10 — **the automation was silently destroying every
day's data**, and recovery now scores sleep-window physiology so it holds still
all day. Root cause found, ingest rebuilt on raw samples, models refit,
2026-08-08→10 repaired. **Not yet committed or deployed.**_

## 2026-08-10 — the automation was overwriting each day with one hour of it

**Symptoms Connor reported:** recovery sank through every afternoon; steps
"only tracking during sleep"; exercise and strain not loading.

**One cause for all three.** The HAE automation ran with
`exportPeriod: "Since Last Sync"` on a 60-minute cadence and `aggregateData:
true`. That sends only the readings taken since the last run — but still
labels them with the DAY. So every hour the phone posted "15 steps,
2026-08-10" and the importer upserted it over the real 4,391. Same mechanism
ate the nights: a window caught the 06:47–08:02 tail of 08-10 and `update: s`
wrote it over the full record, leaving 1.2h where a 5.7h night had been.
`includeWorkouts: false` was a second, independent cause of the strain gap —
no workout had reached the DB since the backfill ended 2026-07-11.

Evidence, before the fix: 2026-08-10 held `step_count 15.4`, `active_energy
0.4`, `basal 1.4`, and `heart_rate min=avg=max=58`. A real day cannot have
min == max; that was one reading, not a day. Backfilled 2026-08-06 for
contrast: 3,433 steps, 286 kcal, HR 40/54/85.

### What changed

1. **Raw samples are now the input.** HAE exports with `Aggregate Data` OFF,
   so every reading carries its own timestamp. `HealthSample` stores
   `heart_rate`, `heart_rate_variability` and `respiratory_rate` verbatim;
   everything else is rolled up into daily rows (SUM for totals, AVERAGE for
   vitals) at import time.
2. **Recovery is scored inside the sleep window** and therefore cannot move
   after you wake. It reads sleeping HR / HRV / respiratory rate only —
   the fit gave sleep DURATION zero weight and it was dropped.
3. **Two guards**, because a partial export window is indistinguishable from a
   quiet day: a daily total never shrinks, and a shorter night never replaces
   a longer one. `X-Import-Mode: replace` lifts both for the backfill.
4. **Strain gained `min>=90bpm`** from the samples. Energy and exercise
   minutes alone could not separate 08-03 (359 kcal, 3 min → Bevel 8) from
   08-07 (336 kcal, 6 min → Bevel 28).
5. Baselines switched from trailing **mean to median**, and sleep-window
   baselines are kept separate from the daily ones.

### 🎯 The finding that mattered

**Bevel's "sleeping bpm" is the mean heart rate across the sleep window, and
we now compute the identical quantity — 0.10 bpm mean difference over nine
nights.**

    date        ours   Bevel  |  date        ours   Bevel
    2026-07-31  46.7   46.7   |  2026-08-05  43.1   43.1
    2026-08-01  64.7   64.6   |  2026-08-06  44.3   44.1
    2026-08-02  41.6   41.7   |  2026-08-07  45.3   45.3
    2026-08-03  43.0   42.6   |  2026-08-09  53.9   53.9
    2026-08-04  45.1   45.1   |  2026-08-10  41.0   —

This closes the old `RECOVERY_LIMIT`. The input is no longer an approximation
of Bevel's input; it is the same number.

### Fit against Bevel, on ten labelled days

| | before (2026-08-09) | now |
|---|---|---|
| sleep | 1.4 | **0.98** |
| strain | 3.8 | **1.30** (08-07 held out) |
| recovery | 6.7 | **3.10** |

Nine of ten recovery days land within 4 points. **2026-08-10 is the exception:
73 against Bevel's 89.**

### ⚠️ Why today is still 16 points short

Not the model — the **baseline history**. Sleep-window history only exists
from 2026-07-27, so today's HRV baseline is a median over 14 nights. Connor's
HRV trended up across that window, lifting the baseline from 58.3 to 68.5, so
today's perfectly good 69.2ms reads as "average". Bevel compares against
months. Proof it is the baseline and not the weighting: 2026-08-02 (41.6bpm,
67.6ms) and 2026-08-10 (41.0bpm, 69.2ms) are near-identical nights that Bevel
scored 86 and 89; we score them 86 and 73.

Tested and rejected: an absolute, baseline-free model gets today to 82 but
costs everything else (MAE 4.91 vs 3.10). The fix is history, not a reweight.

**→ A raw-sample export covering 2026-06-01 → 08-10 should close it.** Re-run
`scripts/fit-bevel.mjs` against it before touching any constant.

### Steps: sum the samples, do not trust the old aggregates

HAE merges iPhone and Watch before exporting — one source label
`Connor's Apple Watch|iPhone`, zero duplicate timestamps. Summing 2026-08-10
gives 4,402 by 14:00 against the 4,391 Connor read at ~15:00. Past days moved
as a result (08-03 went 3,724 → 4,272); the sample sum is the figure validated
against Apple's own display, so it is the one kept.

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
- **Real data is in**, covering 2026-05-09 → 2026-08-10. Daily baselines are
  full. **Sleep-window baselines are not** — those only start 2026-07-27, when
  raw-sample export began, which is the whole of the remaining recovery gap.
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

- **`scripts/test-health-import.mjs`, 33 checks, all passing 2026-08-10**
  against a live server and the real Turso DB: 401 on wrong key, 400 on bad
  JSON, malformed points skipped without failing the batch, re-POST leaves row
  counts byte-identical, sleep hours → minutes, miles → km, workout duration
  derived from timestamps, unknown metrics preserved in `extra`. Seven are new
  and encode the 2026-08-10 bugs directly: a partial window cannot shrink a
  day's step total, a sleep fragment cannot replace a longer night, sub-daily
  readings SUM for totals and AVERAGE for vitals, and recovery is null (not
  zero, not a guess) when nothing was recorded inside the sleep window.
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

Dashboard, Sleep, Lifts and Trends were driven for real on desktop on
2026-08-09. **Recovery and Strain have still never been opened in a browser**,
and 2026-08-10 rewrote the whole Recovery tab — it now shows sleeping HR/HRV
and a reworked breakdown, verified only by `tsc`, `next build` and the API
response. The Bevel tab has never rendered at phone width; a 414px attempt
wedged the Chrome extension. `docs/BEVEL-QA.md` remains unrun as a checklist.

Also outstanding from an earlier session: **Scratchpad checklist buttons
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

⚠️ **Ten labelled days is still a thin fit.** The recovery search sets four
weights and six anchor positions from ten points — it can memorise. The
sleeping-HR input check above is the real evidence. Add rows to `BEVEL` in
`scripts/fit-bevel.mjs` and re-run rather than hand-tuning anything.

## Next steps

1. 🔴 **Connor: set the HAE automation to `Aggregate Data` OFF, `Export
   Period` = Today, `Include Workouts` ON.** Nothing below matters until this
   is done — the app now expects timestamped readings, and the automation is
   still on the setting that caused the bug.
2. 🔴 **Commit and deploy.** Everything from 2026-08-10 is local only. Needs
   `npx vercel --prod`; the DB is already migrated (see 3).
3. **Schema is already applied to Turso** — `HealthSample` via `db:push`, the
   six `SleepSession` columns via hand-written `ALTER TABLE` because `db:push`
   only emits `CREATE TABLE`. Do not re-run those ALTERs blindly.
4. **Raw-sample export for 2026-06-01 → 08-10**, then re-run
   `scripts/fit-bevel.mjs` — the only route to closing today's 16-point
   recovery gap, which is a baseline-history problem, not a model one.
5. **Rotate `HEALTH_IMPORT_KEY`** — it is in the 2026-08-09 transcript AND in
   plaintext in the automation config file Connor uploaded 2026-08-10.
6. **Device QA on the iPhone PWA** (`docs/BEVEL-QA.md`) — still unrun.
7. **Delete `scripts/migrate-from-neon.mjs` and `npm uninstall pg @types/pg`.**
   The Neon project was to be decommissioned ~one week after 2026-05-09.

## Open questions

- Orrery tuning is open and cheap (`src/components/orrery/Orrery3D.tsx`).
  ⚠️ It also **wedges the Chrome extension** — script injection times out
  while the Calendar tab is mounted, which cost real time this session.
  Work around it by opening a fresh tab straight onto another view.
- Backlog, unstarted: per-screen depth / hero imagery — Connor, 2026-08-07,
  *"don't make it yet, keep it in mind."*
