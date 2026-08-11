# 28 — Retire `update.md`, keep its deferred block

**Severity** cleanup · **Effort** ~15min · **Approved** 2026-08-10
**Source** run-3 finding 22 · evidence `../overnight/audits/002-update-md.md`

## Change

Move `:26-30` "Deferred / known issues" into `docs/NOTES.md`, then delete the file.

## Where

`update.md` (repo root)

## Why

One entry (2026-05-11), untouched for 41 commits; its commit message reproduces most
of it verbatim. Unreferenced anywhere.

**But its deferred block is still true and recorded nowhere else** — verified
against source: 16 bare `await req.json()` sites, 5 `parseInt` param sites with
**zero** guards, and `api/habits/route.ts:10` still `take: 400` with an unbounded
include.

Delete the file without rescuing that block and those four facts are lost.

## Verify

The four deferred items appear in `docs/NOTES.md`; `update.md` is gone.
