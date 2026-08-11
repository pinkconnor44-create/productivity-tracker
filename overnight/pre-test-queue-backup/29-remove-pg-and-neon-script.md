# 29 — Remove `pg`, `@types/pg` and the Neon migration script

**Severity** cleanup · **Effort** ~15min · **Approved** 2026-08-10
**Source** the run-3 review action item (carried from runs 1–2); confirmed still present
in run 3

## Change

`npm uninstall pg @types/pg` and delete `scripts/migrate-from-neon.mjs`.

## Where

`package.json`, `scripts/migrate-from-neon.mjs`

## Why

Neon was decommissioned; the database is Turso via `@libsql/client`. The script is
dead and the two packages are unused weight in the dependency tree. the retired run-3 map (now deleted)
already files the script under "Don't bother reading".

`HANDOFF.md` lists this as one of the project's own open items; run 3 confirmed all
three are still present.

## Verify

`npm ls pg` reports nothing; the script file is gone; `npm run build` is clean.
