# 18 — No linter, no test gate

**Severity** risk · **Effort** ~1h · **Approved** 2026-08-10
**Source** the run-3 review action item (carried from runs 1–2)

## Change

Add `eslint` with `eslint-plugin-react-hooks`, and wire `scripts/test-health-import.mjs`
into an `npm test` that can run **only** against a disposable target — never
production Turso (see item 20).

## Where

`package.json`, plus a new `.eslintrc`/`eslint.config.mjs`

## Why

`npx tsc --noEmit` plus `next build` is the entire gate. `eslint` **does not exist**
in this project — `FloatingStopwatch.tsx:45` even carries an `eslint-disable` comment
for a linter that was never installed.

Run 3 found seven `bug`-severity defects that `tsc` cannot see, several of them
hook-dependency and effect-cleanup shaped — exactly what `react-hooks` catches.

Caveat, and it matters: `react-hooks/exhaustive-deps` would **not** have caught item
04 — `[notes]` is precisely what that rule demands. A linter narrows the gap; it
does not close it.

## Verify

`npm run lint` exits 0 on a clean tree and non-zero on a deliberately broken
dependency array.
