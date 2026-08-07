# HANDOFF

> Living session note: where things stand + what to do next. Update at the end of each work session so the next one (you or Claude) has context fast.

_Last updated: 2026-08-07 — **Bevel Phases 0–5 are built, verified and on a
preview deploy.** The health pipeline, the Bevel tab and the Lifts relocation
are done; what remains needs Connor's phone and his approval._

## Current state

Branch **`feature/bevel-health`**, 4 commits ahead of `main`. `main` itself is
still **18 commits ahead of origin — nothing has ever been pushed.**

**Preview (Phase 8 gate):**
https://productivity-tracker-466gt6m76-pinkconnor44-creates-projects.vercel.app
Prod is untouched and still serves the pre-Bevel app.

- **Phases 0–5 complete.** Three additive tables live on Turso; `POST
  /api/health-import` (the app's first authed route); `GET /api/health` with
  trailing baselines and the three scores; the Bevel tab with six sub-tabs;
  backfill + seed + wipe scripts.
- **Lifts is no longer a top-level tab** — it is the Lifts sub-tab of Bevel,
  same component, same APIs, same tables. Only its mount point moved.
- **Phase 6 was already done** (score rings, shipped as C6 last session).
- `HEALTH_IMPORT_KEY` is in `.env` and in all three Vercel environments.
- The design-system rebuild from the previous session is unchanged and still
  deployed to prod.

⚠️ **The Bevel tab is currently showing ~75 days of DEMO data**, seeded through
the real endpoint by `scripts/seed-health-fixtures.mjs` so the tab could be
reviewed before the app purchase. Preview and prod share one Turso database.
**Run `node scripts/wipe-health-fixtures.mjs --yes` before the first real
backfill** or invented HRV values will sit inside the same trailing baselines
as Connor's real readings.

## Verified vs unverified

**Verified** — by running it, not by reading it:
- `scripts/test-health-import.mjs`, 21 checks against a live server and the real
  Turso DB: 401 on wrong key, 400 on bad JSON, malformed points skipped without
  failing the batch, re-POST leaves row counts byte-identical, sleep hours →
  minutes, miles → km, workout duration derived from timestamps, unknown metrics
  preserved in `extra`.
- `GET /api/health` over the 75 seeded days: 30-day baselines full and no longer
  calibrating, every day carries a recovery score, scores land in sensible bands.
- `npm run build` clean; `npx tsc --noEmit` clean; both new routes in the build
  output.
- SSR'd shell contains `data-tab="bevel"` and no longer contains Lifts.

**NOT verified — the real gap:** *nothing in the Bevel UI has been rendered.*
The Chrome extension was not connected this session, so no browser drove the
app at all. Types and the build pass, and the data layer is exercised hard, but
a runtime error inside a sub-tab's render would not have been caught. Treat
`docs/BEVEL-QA.md` as genuinely unrun, not as a formality.

This also means last session's outstanding phone QA (Scratchpad checklist
buttons visible without hover) is *still* outstanding.

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
  heuristic. This is the second-most-likely thing to be wrong on first contact
  with a real payload, after the timezone assumption.

## Next steps

1. **Device QA on the iPhone PWA** — `docs/BEVEL-QA.md` is the checklist. This
   is the outstanding item and it is genuinely unrun.
2. **Buy Health Auto Export — JSON+CSV** (~$24.99). Still the long pole: the
   30-day baselines need calendar time to fill once it is running.
3. Configure the HAE automation — the empty state in the app lists the five
   steps and shows the endpoint URL for whichever deployment you are on.
4. `node scripts/wipe-health-fixtures.mjs --yes`, then backfill with
   `scripts/backfill-health.mjs` per month of export.
5. **Phase 8**: approve → merge `feature/bevel-health` → `npx vercel --prod`.
6. `git push` — still 18+ commits local-only.

## Open questions / blockers

- **Connor to buy Health Auto Export.** Blocks Phase 5 and nothing else; the
  entire code path is built and testable without it.
- **Approval to merge and deploy prod** — deliberately not done.
- Whether to keep the demo seed data around for a while (it makes the tab
  reviewable) or wipe it now. Wipe is mandatory before real backfill either way.
- Orrery tuning is still open and cheap — `src/components/orrery/Orrery3D.tsx`.
- Backlog, unstarted: per-screen depth / hero imagery (Connor, 2026-08-07,
  "don't make it yet, keep it in mind"). See the end of `plan.md`.
