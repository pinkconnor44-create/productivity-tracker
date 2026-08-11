# 20 — `scripts/*.mjs` sits outside every gate

**Severity** risk · **Effort** ~1h · **Approved** 2026-08-10
**Source** the run-3 review action item (carried from runs 1–2); the run-3 map "Tools"

## Change

Bring `scripts/` under the type-check and the linter from item 18. At minimum, make
the destructive ones refuse to run without an explicit non-production target.

## Where

`scripts/` — 8 files, including `backfill-health.mjs`, `test-health-import.mjs`,
`wipe-health-fixtures.mjs`

## Why

`npx tsc --noEmit` covers `src/` only. Nothing checks `scripts/` — including
`backfill-health.mjs`, **the tool that repairs production health data**, and
`wipe-health-fixtures.mjs`, which deletes.

⛔ Standing constraint that makes this urgent rather than tidy: preview, prod and
local `npm run dev` all point at **one Turso instance**, so any script run is a
production write. `test-health-import.mjs` must not be run against any base URL; its
fixtures are dated 2019 on purpose.

Four of the eight scripts were **not examined by any agent** in run 3
(`seed-health-fixtures`, `wipe-health-fixtures`, `push-schema`, `smoke-test`).

## Verify

A syntax error in a script fails the gate. A destructive script exits non-zero when
pointed at the production URL without an explicit override.
