# 001 — `plan.md` (repo root, 15,514 B, 169 lines)

**Verdict: refined** · **Severity: `cleanup`** (docs-only; no code reads it) ·
**Verified** (git history + grep + line-by-line comparison against
`schema.prisma`, `src/lib/health.ts`, `src/lib/health-import.ts`, `CLAUDE.md`,
`HANDOFF.md`) · **Defect**, not taste — five of the contradictions are
statements of fact that are false today, and one of them contradicts a live
`CLAUDE.md` rule.

---

## What killed part of the framing

**"Unreferenced" is false.** `overnight/candidates.md:32` scores `plan.md` at
"❌ none" for references. Six files cite it, two by **line number**:

| Citation site | Text |
|---|---|
| `src/components/ui/metricColors.ts:6` | "`plan.md:66` originally made `scoreColor` the Ring default; this is the correction." |
| `src/components/ui/TrendChart.tsx:40` | "(`plan.md:73` originally called for a copy)" |
| `src/components/ui/SegmentedControl.tsx:19` | "which is what `plan.md` originally called for" |
| `src/lib/health-import.ts:87` | "the single highest-risk assumption in the import path (`plan.md` 'Key risks')" |
| `docs/BEVEL-OPEN-ISSUES.md:127` | "was flagged as a risk in `plan.md` from the start" |
| `plan.md:139` | self-reference to `plan.md:66` |

I checked both line-numbered citations against the current file: `plan.md:66`
**is** the Ring bullet naming `scoreColor()` as the default, and `plan.md:73`
**is** the Trends bullet calling for a copy of `StatsView.tsx:51-127`. Both are
still accurate. So the file is a **cited historical record**: four source
comments explain a deliberate deviation by pointing at it. Deleting it — or
editing anything above line 73 — breaks those citations.

That is the part of the finding that dies. "Move it or bin it" was the wrong
prescription; it has to be moved *and* the citations re-pointed, or it stops
being an asset the moment anyone touches it.

## What survives — it is not live, and the top of the file lies

`git log --follow`: three commits, `81bc2d0` (2026-07-27), `8b4cf43`
(2026-08-06), `b0687e1` (2026-08-07). **Untouched for three days and two major
sessions** (2026-08-09 rework/calibration, 2026-08-10 ingest rebuild), both of
which invalidated parts of it.

It was maintained as a living doc — `b0687e1` rewrote the STATUS block in
place, superseding a "parked" one. That maintenance stopped; everything below
now describes a state that no longer exists.

### Contradictions, verified

| `plan.md` | Says | Reality |
|---|---|---|
| **`:3`** | "**Not yet executed.**" | Phases 0–8 complete, merged to `main`, in prod (`HANDOFF.md:114-124`). Contradicted by `plan.md:118` in the same file. |
| **`:77`** | "Follow repo conventions: dark-only, **`violet-*` for accent**" | `CLAUDE.md`: "Use `primary-*`, **never** `violet-*`." Grepped `src/`: zero live `violet-*` classes; the only hits are `globals.css:18` and `SettingsView.tsx:7` explaining that `violet-*` survived the palette swap and stayed off-palette. |
| **`:59`** | "Baselines: 30-day trailing **mean**" | `src/lib/health.ts:195-205` `baselineOf` returns the **median**. |
| **`:60`** | Sleep = 0.70·duration + 0.15·deep% + 0.15·REM% | `HEALTH_CONSTANTS.SLEEP` is `DURATION_ANCHORS` only; `health.ts:88` — stage mix "deliberately NOT weighted any more". |
| **`:61`** | Recovery = 0.5·HRV + 0.3·restingHR + 0.2·sleep score | `health.ts:104-111`: `W_SLEEP_HR 0.60 / W_SLEEP_HRV 0.35 / W_SLEEP_RESP 0.05`, sleep duration weight **zero**, all measured inside the sleep window. |
| **`:62`** | Strain = 0.6·kcal + 0.4·exercise min | Gained a `min>=90bpm` term on 2026-08-10 (`HANDOFF.md:55-57`). |
| **`:46`** | "Daily aggregates only in v1 (**no minute-level samples**)" | `prisma/schema.prisma:159` `model HealthSample` stores every raw reading; it is now the import's primary input. |
| **`:28-31`** | "main untouched", "deploys are **preview-only**", "DB revert = `DROP TABLE` × 3" | Merged and prod-deployed; five health tables now (`HealthSample`, `HealthImportLog` added). |
| **`:5-6`** | "an Ultraplan cloud session is executing a refined copy … results will land as a GitHub PR" | No such PR in the history; the work was done locally. |
| **`:145-149`** | "Remaining: Phase 5 proper (buy HAE, configure automation, wipe demo rows, backfill); Phase 8 (approve, merge, prod)" | HAE Premium active 2026-08-09, automation working, demo seed wiped, data 2026-05-09→08-10, merged, deployed. Only **Phase 7 device QA** is still true, and `HANDOFF.md` next-step 4 + `docs/BEVEL-QA.md` already carry it. |
| **`:133`** | "delivered as C6 **last session**" | Violates absolute-dates-only. One occurrence; the file is otherwise clean (grepped `yesterday`/`this session`/`recent` — the other hits are ordinary prose). |

**The two with real blast radius** are `:77` and `:59-62`. A future reader
treating the plan as spec would reintroduce `violet-*` (off-palette, silently)
or hand-restore the pre-fit score weights — which `CLAUDE.md` explicitly
forbids ("Never hand-tune one — add days to `BEVEL` in `scripts/fit-bevel.mjs`
and re-run"). The rest is inert but makes the file untrustworthy, and `:3` is
the worst of them: a reader who stops at line 3 gets the exact opposite of
reality about a shipped feature.

### Three things live only here

Deletion loses them; this is why "just bin it" is wrong.

1. **`:151-169` hero-imagery backlog.** `HANDOFF.md:270-271` carries only the
   one-line headline. The four notes — glass as the right substrate, the
   ~94% page-weight measurement from `the-stack.md`, the contrast-scrim
   requirement, and the open per-screen-vs-shared art-direction question —
   exist nowhere else (grepped all `*.md`).
2. **`:87`** "CalendarView strip deferred — noted as follow-up." The only
   record of that follow-up in the repo.
3. **`:15`** Nutrition / Biological Age omitted, "noted as future." Also
   unique.

## What I tried in order to kill it

- `git log --follow` for age and whether it is still maintained → maintained
  until 2026-08-07, then abandoned mid-project.
- Grepped the whole tree for references, expecting none → found six, which
  killed the "unreferenced, therefore dead" half of the item.
- Checked both line-numbered citations resolve correctly → they do, so the
  file is load-bearing as a record and the item cannot be closed by deletion.
- Compared every technical claim against `schema.prisma` and `src/lib/*`
  rather than against the handoff prose, hoping the drift was cosmetic → it is
  not; the scoring section describes a model that was replaced twice.
- Looked for the unique content elsewhere, hoping it was duplicated and the
  file was safely redundant → three items are not.

Did **not** run `tsc` — the item touches no code. No file was modified.

## Fix

Move to `docs/BEVEL-PLAN.md` headed "Historical — executed; superseded
2026-08-10, see `HANDOFF.md`", delete `:3`, `:5-6`, `:27-33` and `:118-149`
(the status/remaining/reversibility blocks) and correct `:59-62` and `:77` in
place, relocate `:15`, `:87` and `:151-169` to `HANDOFF.md`'s backlog, then
re-point the six citations — `metricColors.ts:6` and `TrendChart.tsx:40` carry
line numbers that will shift — and add the file to `CLAUDE.md`'s See-also.

**Effort:** ~45 min.

## Adjacent, not this item

`docs/BEVEL-OPEN-ISSUES.md:119-131` still explains the Bevel recovery gap as
"0.5·HRV + 0.3·RHR + 0.2·sleep" and "we use HAE's daily-aggregate HRV, Bevel
uses sleeping HRV" — both superseded on 2026-08-10, when sleep-window recovery
landed and `HANDOFF.md:61-75` recorded a 0.10 bpm match against Bevel's own
sleeping-bpm figure. Same drift class, different file; not raised as part of
001. Also unassessed: `update.md` (4,527 B, root, last touched 2026-05-11),
which `candidates.md:32` groups with `plan.md`.
