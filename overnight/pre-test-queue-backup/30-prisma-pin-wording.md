# 30 — `CLAUDE.md` says Prisma is "pinned"; it is a caret range

**Severity** cleanup · **Effort** minutes · **Approved** 2026-08-10
**Source** the run-3 review action item (carried from runs 1–2)

## Change

Either pin the versions for real (drop the `^` in `package.json`) or change the
wording. Pinning is the better call — the rule exists because the adapter major must
match `@prisma/client`, and a caret range is exactly what breaks that silently.

## Where

`package.json` (`prisma`, `@prisma/client`, `@prisma/adapter-libsql`) and the
schema-changes bullet in `CLAUDE.md` — note it moved when the `overnight` convention
was logged on 2026-08-10.

## Why

`CLAUDE.md` states both are "pinned `5.22.0`". `package.json` uses `^5.22.0`, so a
fresh `npm install` can take a different minor for one and not the other. The rules
file asserts a guarantee the manifest does not provide.

## Verify

`package.json` and `CLAUDE.md` say the same thing about the version constraint.
