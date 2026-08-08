# HANDOFF

> Living session note: where things stand + what to do next. Update at the end of each work session so the next one (you or Claude) has context fast.

_Last updated: 2026-08-07 — **Bevel Phases 0–8 are done and merged to prod, and
91 days of Connor's real Apple Watch data are imported and verified.** The
phone automation still delivers nothing and the recovery score disagrees with
Bevel's; both are parked in `docs/BEVEL-OPEN-ISSUES.md`._

## Current state

**Merged to `main` and deployed to prod** — https://productivity-tracker-murex.vercel.app.
`main` is **28 commits ahead of origin; nothing has ever been pushed.**
`feature/bevel-health` was merged with `--no-ff`, so `git revert -m 1 1b0cc48`
undoes the entire feature in one step.

- **Phases 0–8 complete.** Three additive tables on Turso; `POST
  /api/health-import` (the app's only authed route); `GET /api/health` with
  trailing baselines and the three scores; the Bevel tab with six sub-tabs;
  backfill/seed/wipe scripts; merged and deployed.
- **Lifts is no longer a top-level tab** — it is the Lifts sub-tab of Bevel,
  same component, same APIs, same tables. Only its mount point moved.
- **Phase 6 was already done** (score rings, shipped as C6 earlier the same day).
- **Real data is in**: 1,708 metric rows, 62 nights, 11 workouts covering
  2026-05-09 → 2026-08-07. Baselines are full and no longer calibrating, so
  every score is meaningful now — the "wait 30 days" caveat only applied to
  starting from empty, and backfill removed it.
- The demo seed has been wiped. `scripts/seed-health-fixtures.mjs` still exists
  for demoing an empty install; `wipe-health-fixtures.mjs` clears it.
- `HEALTH_IMPORT_KEY` is in `.env` and all three Vercel environments.

## Verified vs unverified

**Verified** — by running it, not by reading it:
- `scripts/test-health-import.mjs`, 26 checks against a live server and the real
  Turso DB: 401 on wrong key, 400 on bad JSON, malformed points skipped without
  failing the batch, re-POST leaves row counts byte-identical, sleep hours →
  minutes, miles → km, workout duration derived from timestamps, unknown metrics
  preserved in `extra`, and the three real-export shapes below.
- **The real export parsed correctly**: 1,708 metrics / 62 nights / 11 workouts
  over 91 days, nothing skipped, sleep averaging 7.07h across a 4.04–9.35h range.
- **Day attribution is correct — confirmed against Apple Health by Connor.**
  Sleep durations for 2026-08-04→07 matched exactly (6.8 / 7.1 / 8.6 / 7.6h).
  This closes the highest-risk assumption in the whole pipeline: `toLocalDay()`
  taking `slice(0,10)` of HAE's timestamp really is the phone's local day.
- **Auth against prod**: correct key → row counts, trailing-whitespace key →
  accepted, wrong key → 401, no key → 401.
- `npm run build` and `npx tsc --noEmit` clean; both routes in the build output;
  prod serves `data-tab="bevel"` and no longer serves Lifts.

**NOT verified — the same real gap as before:** *nothing in the Bevel UI has
ever been rendered.* The Chrome extension was not connected, so no browser
drove the app at any point — including before it was merged and deployed to
prod. Types and the build pass and the data layer is exercised hard, but a
runtime error inside a sub-tab's render would not have been caught. Connor has
looked at it on his phone and likes it, which is partial evidence, but
`docs/BEVEL-QA.md` is genuinely unrun.

Last session's outstanding phone QA (Scratchpad checklist buttons visible
without hover) is *still* outstanding.

## Traps found this session

- **`prisma generate` fails with `EPERM … rename query_engine-windows.dll.node`
  while `next dev` is running.** Already documented, hit it again. Stop the dev
  server before any build.
- **Preview deployments are behind Vercel deployment protection** — curl gets a
  302 to SSO, and Safari on the phone will too. Sign into Vercel on the phone
  once, or turn protection off in project settings.
- **`statusFor` lives in `ui/metricColors`, not `lib/health`** — the health lib
  is pure scoring and deliberately imports nothing from the component tree.
- **HAE's workout `duration` has shipped in both seconds and minutes.** The
  parser prefers `end - start` and only falls back to `duration` with a >600
  heuristic. Real payload confirmed seconds.
- **`"asleep": 0` with the real value in `totalSleep` — on 58 of 62 nights.**
  A first-non-null pick returns the 0, which is indistinguishable from "slept
  zero hours", and would have destroyed most of the sleep history silently.
  Zero is not a measurement in these fields; it marks the field as *not the one
  carrying the value*. Also: `asleep` is the unspecified-stage **component**,
  and `totalSleep = core + deep + rem + asleep` — it is not the total.
  **General lesson: `?? `/first-non-null is the wrong operator for any numeric
  field where an absent value is encoded as 0.**
- **A secret set through a PowerShell pipe does not land.** `$k | npx vercel env
  add …` stored something that was not the key, and prod 401'd its own correct
  key. Use `printf '%s' "$k" | …` from bash. The endpoint now trims both sides,
  because this failure looks exactly like a wrong key on a background job
  nobody is watching.
- **Test fixtures used real recent dates and overwrote real data.** Running the
  suite against the shared Turso DB clobbered 2026-08-05/06 readings. Restored
  from the export and verified. Fixture dates moved to **2019** — two decades
  out of range cannot collide. *Preview, prod and local dev all share one
  database; there is no test database.*
- **`score-refresh` fires on every tab change and Bevel stays mounted**, so it
  was refetching its whole range while the user sat on other tabs. Guarded by
  an off-screen check (`offsetParent === null`).

## ⚠️ Parked here — two open issues

**`docs/BEVEL-OPEN-ISSUES.md` is the pickup point.** Connor stopped here on
2026-08-07 to come back later.

1. **HAE reports success but zero POSTs ever reach the server.** Confirmed from
   Vercel runtime logs, not inferred — no request is being made at all, so it
   is neither an auth nor a parse problem. Auth *was* broken separately (the
   Vercel env var was set through a PowerShell pipe and didn't land); that is
   fixed and verified, and is not this. **Check first whether HAE Premium was
   actually bought** — REST API automations are a paid feature, a manual export
   is not, and a free-tier install showing automation UI while never sending
   fits the evidence better than anything else on the list.
2. **Recovery does not match Bevel's numbers.** Expected to some degree — these
   were always approximations — but the likely real cause is that Bevel uses
   *sleeping* HRV while this app uses HAE's whole-day HRV average. Different
   quantity, systematic divergence. Fixable by exporting minute-level HRV and
   isolating the sleep window. Investigate the input before tuning any weights.

## Next steps

1. **Work `docs/BEVEL-OPEN-ISSUES.md`** — the automation delivering nothing,
   then the recovery/HRV mismatch. Start with the HAE Premium check.
2. **Device QA on the iPhone PWA** — `docs/BEVEL-QA.md`. Still unrun, and the
   feature is now in production, so this is overdue rather than pending.
3. `git push` — **28 commits local-only**, including the entire Bevel feature.
   There is no off-machine copy of any of it.
4. Ongoing data: once the automation works it is hands-off (hourly, upserts,
   gaps self-heal). Further history beyond 2026-05-09 needs one HAE file export
   per month through `scripts/backfill-health.mjs`.

## Open questions / blockers

- **Is HAE Premium purchased?** Unconfirmed, and it gates the REST API
  automation. Leading candidate for issue 1.
- **Recovery input**: switching from whole-day to sleeping HRV means storing
  minute-level HRV samples — a schema addition. Decide before tuning weights.
- Orrery tuning is still open and cheap — `src/components/orrery/Orrery3D.tsx`.
- Backlog, unstarted: per-screen depth / hero imagery (Connor, 2026-08-07,
  "don't make it yet, keep it in mind"). See the end of `plan.md`.

_(Resolved this session and removed from this list: the merge/deploy approval
gate, and whether to keep the demo seed — merged and deployed, seed wiped, real
data in.)_
