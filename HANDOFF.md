# HANDOFF

> Living session note: where things stand + what to do next. Update at the end of each work session so the next one (you or Claude) has context fast.

## Current state
- 2026-07-21: **Bevel Health integration is fully planned but NOT started.**
  The approved plan lives at **`plan.md` in this folder — read it first when
  picking this back up.** It covers: a new "Bevel" tab (Dashboard rings /
  Sleep / Recovery / Strain / Lifts / Trends sub-tabs) fed by Apple Watch data
  via Health Auto Export → new `/api/health-import` endpoint, historical
  backfill, moving LiftTracker into the Bevel tab (Lifts tab removed),
  embedding Scratchpad into the Calendar tab (Scratchpad tab removed),
  app-wide ring polish, full mobile parity, and reversibility guarantees
  (feature branch + preview-only deploys + additive-only DB tables).
- An Ultraplan cloud session that was executing this plan was **canceled by
  Connor** — no PR/branch landed; nothing remote to reconcile. He'll pick the
  work up later, locally, from `plan.md`.

## Next steps
- **When resuming: read `plan.md`, then start at Phase 0** (branch
  `feature/bevel-health` + `HEALTH_IMPORT_KEY` env var).
- Before Phase 5, Connor needs to buy Health Auto Export Premium (iOS app).

## Open questions / blockers
- _(none)_
