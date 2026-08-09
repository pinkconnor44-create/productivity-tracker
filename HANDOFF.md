# HANDOFF — Productivity Tracker

> State only. Rules are in `CLAUDE.md`, component detail in `docs/NOTES.md`,
> cross-project traps in `dev\TRAPS.md`.

_Last updated: 2026-08-09 — Bevel's header and range picker replaced by a day
scroller, the rest timer confined to Lifts, and the import log taught to record
rejected requests. **All three driven in a real browser** — the first time any
of this UI has been. Not deployed: `npx vercel --prod` is still owed._

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

## 2026-08-09 — three changes, all driven in a browser, none deployed

**⚠️ `npx vercel --prod` is owed.** No schema change, so **no `db:push`**.
Until it runs, the phone still posts to the old build and the new diagnostic
cannot fire.

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
2. **Rest timer confined to the Lifts sub-tab.** It was showing across all of
   Bevel. `liftsActive` now lives on the stopwatch context: BevelView sets it,
   Shell reads it. The overlays stay rendered by **Shell**, not BevelView,
   because `tab-fade` animates `transform` and would trap `position: fixed`
   inside the tab panel. A **running** timer is exempt from the gate — hiding a
   live count because you glanced at Recovery would lose the rest interval.
3. **Import log now records rejected requests** — see
   `docs/BEVEL-OPEN-ISSUES.md` § 2026-08-09. This is the actual finding behind
   task 1.

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
**Recovery and Strain** (changed the same way, never opened), and **every
sub-tab at phone width** — the day scroller in particular is a horizontally
scrolling strip that has only been seen at 1568px. `docs/BEVEL-QA.md` remains
unrun as a checklist.

Also still outstanding from an earlier session: **Scratchpad checklist buttons
visible without hover** on the phone.

## ⚠️ Parked — two open issues

`docs/BEVEL-OPEN-ISSUES.md` is the pickup point.

1. **HAE reports success but no data arrives.** Row counts are still the
   backfill's and the import log is still empty as of 2026-08-09.
   ⚠️ **The earlier "zero POSTs ever reach the server, confirmed from Vercel
   runtime logs" is weaker than it was written.** That reading was a snapshot,
   and the import log could not have corroborated it: until 2026-08-09 a 401 or
   400 wrote no row, so an empty log was equally consistent with requests
   arriving and being rejected. Rejections are logged now, which turns the next
   automation run into the answer — see `docs/BEVEL-OPEN-ISSUES.md`.
   (Auth *was* separately broken once because the Vercel env var was set
   through a PowerShell pipe and didn't land; that is fixed and verified, and
   is a different thing.) **Still check whether HAE Premium was actually
   bought** — REST API automations are a paid feature, a manual export is not,
   and a free-tier install showing automation UI while never sending fits the
   evidence better than anything else on the list.
2. **Recovery does not match Bevel's numbers.** Expected to a degree — these
   were always approximations — but the likely real cause is that Bevel uses
   **sleeping** HRV while this app uses HAE's **whole-day** HRV average.
   Different quantity, systematic divergence. **Investigate the input before
   tuning any weights.** Fixing it means exporting minute-level HRV and
   isolating the sleep window — a schema addition.

## Next steps

0. **Deploy** — `npx vercel --prod`. Everything from 2026-08-09 is local only,
   and the import diagnostic cannot fire until the phone is posting at the new
   build. (A deploy was attempted this session and blocked by the permission
   classifier, not by any problem with the change.)
1. **Work `docs/BEVEL-OPEN-ISSUES.md`**, starting with the HAE Premium check —
   and after deploying, just let the automation run once and read Bevel's
   status line, which now names the reason.
2. **Device QA on the iPhone PWA** (`docs/BEVEL-QA.md`) — unrun, and the feature
   is in production, so this is overdue rather than pending.
3. **Delete `scripts/migrate-from-neon.mjs` and `npm uninstall pg @types/pg`.**
   The Neon project was to be decommissioned ~one week after 2026-05-09; this is
   about three months overdue and was sitting in `CLAUDE.md` where nothing would
   ever surface it.
4. Ongoing data is hands-off once the automation works (hourly, upserts, gaps
   self-heal). History before 2026-05-09 needs one HAE export per month through
   `scripts/backfill-health.mjs`.

## Open questions

- **Is HAE Premium purchased?** Gates the REST API automation; leading candidate
  for issue 1.
- **Recovery input** — whole-day vs sleeping HRV. Decide before tuning weights.
- Orrery tuning is open and cheap (`src/components/orrery/Orrery3D.tsx`).
- Backlog, unstarted: per-screen depth / hero imagery — Connor, 2026-08-07,
  *"don't make it yet, keep it in mind."*
