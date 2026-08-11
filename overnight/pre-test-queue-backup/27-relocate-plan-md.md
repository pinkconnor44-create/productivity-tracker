# 27 — `plan.md` is a cited historical record presenting itself as live

**Severity** cleanup · **Effort** ~45min · **Approved** 2026-08-10
**Source** run-3 finding 21 · evidence `../overnight/audits/001-plan-md.md`

## Change

Move to `docs/BEVEL-PLAN.md`, head it as a **historical record**, and re-point all
six citations — including the two by line number. Rescue the three items that live
only here before touching anything else.

## Where

`plan.md` (repo root). Citations: `ui/metricColors.ts:6` → `plan.md:66`,
`ui/TrendChart.tsx:40` → `plan.md:73`, plus four by name.

## Why

⚠️ **It cannot simply be deleted** — an agent corrected the run-3 enumeration on
this: six files cite it, **two by line number**, and both still resolve.

But `:3` says "**Not yet executed**" against phases 0–8 that are in production, and
11 claims are contradicted — including `:77` "use `violet-*`" against `CLAUDE.md`'s
"never `violet-*`". It also contains "last session", violating the absolute-dates
rule.

Three items live **only** here: the hero-imagery backlog, the CalendarView polish
strip, and the Nutrition deferral.

## Verify

Both line-number citations resolve to the same content at the new path; no doc
claims the shipped phases are unexecuted.
