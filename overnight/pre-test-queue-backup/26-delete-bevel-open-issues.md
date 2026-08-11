# 26 — Delete `docs/BEVEL-OPEN-ISSUES.md`

**Severity** cleanup · **Effort** minutes · **Approved** 2026-08-10
**Source** run-3 finding 20 · evidence `../overnight/audits/003-bevel-open-issues.md`

## Change

Delete the file and fix the two references it dangles: `HANDOFF.md:164` and
the retired run-3 map (now deleted).

## Where

`docs/BEVEL-OPEN-ISSUES.md`

## Why

Both of its issues are closed — one on 2026-08-09, the other by today's health
rework. **Nothing unique survives.** Six live contradictions remain, the dangerous
one being `:160` *"Baselines full, not calibrating"* against `HANDOFF.md`, which says
sleep-window baselines start 2026-07-27 and are **the whole remaining recovery gap**.
The doc declares settled the one thing that is actually open.

`:139-142` is now the exact inverse of the recovery-locking rule. `:162` claims
`main` is 24 commits ahead of origin; `git rev-list --count origin/main..main`
returns **0**.

## Verify

The file is gone and no grep hit for `BEVEL-OPEN-ISSUES` remains.
