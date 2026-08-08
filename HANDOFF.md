# HANDOFF — Productivity Tracker

> State only. Rules are in `CLAUDE.md`, component detail in `docs/NOTES.md`,
> cross-project traps in `dev\TRAPS.md`.

_Last updated: 2026-08-07 — Bevel is merged, deployed and carrying 91 days of
real Apple Watch data; the phone automation still delivers nothing and recovery
disagrees with Bevel. Both parked in `docs/BEVEL-OPEN-ISSUES.md`._

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

**Nothing in the Bevel UI has ever been rendered.** The Chrome extension was
never connected, so no browser drove the app at any point — including before it
was merged and deployed to prod. Types and the build pass and the data layer is
exercised hard, but a runtime error inside a sub-tab's render would not have
been caught. Connor has looked at it on his phone and likes it, which is partial
evidence, but **`docs/BEVEL-QA.md` is genuinely unrun.**

Also still outstanding from an earlier session: **Scratchpad checklist buttons
visible without hover** on the phone.

## ⚠️ Parked — two open issues

`docs/BEVEL-OPEN-ISSUES.md` is the pickup point.

1. **HAE reports success but zero POSTs ever reach the server.** Confirmed from
   Vercel runtime logs, not inferred — no request is being made at all, so it is
   neither auth nor parsing. (Auth *was* separately broken because the Vercel
   env var was set through a PowerShell pipe and didn't land; that is fixed and
   verified, and is not this.) **Check first whether HAE Premium was actually
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

1. **Work `docs/BEVEL-OPEN-ISSUES.md`**, starting with the HAE Premium check.
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
