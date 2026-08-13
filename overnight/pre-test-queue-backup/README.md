# New changes — approved work queue

**This folder is the authorisation boundary.** A finding in the run-3 review is a
*proposal*. Only what is in here is approved to be implemented. Nothing gets built
from `../overnight/candidates.md` directly.

Approved by Connor on **2026-08-10** from overnight runs 1–3 (32 findings raised, 31
approved, 1 declined). Tick a box only once the change is **deployed and verified**,
not once it compiles.

Each file carries: what to change · where · why (the verified evidence) · how to
verify. Deep working evidence stays in `../overnight/audits/NNN-*.md`.

⚠️ **This index covers the runs 1–3 migration only.** `/audit` writes its work orders
straight into this folder and does not update this file, so a later run's items will
be present as files but absent from the lists below. **Numbers 01–32 are taken** —
the next promotion starts at 33.

**2026-08-12 — items 01–31 implemented and deployed to prod** (Connor's "complete
all 31" instruction; DESIGN.md deleted rather than rewritten, per his call). **32
was excluded by Connor** — the `dev\TRAPS.md` edit stays with him. Verified from
the CLI: built CSS emits the /NN variants; streak invariant holds on prod data
(current 25 ≤ longest 52); DB columns added + 12 habits backfilled; `npm run
check` (tsc + scripts-tsc + eslint) exits 0. **Not yet re-verified on devices:**
13/14/16's visual checks and 06/10/11's throttled-network checks.

## Declined — do not implement

- **Excused days count as misses in every habit percentage** (run-3 finding 6,
  `HabitsView.tsx:57-72`). Connor declined on 2026-08-10: the 30-day card reading
  **65% (119/183)** rather than **83% (118/143)** is the intended behaviour. Do not
  re-raise it, and do not "fix" it as a side effect of item 08 or 03 — those touch
  the same denominators.

## Bugs — defects visible on screen today

- [x] **01** [Add `<alpha-value>` to `on-surface-variant`](01-tailwind-alpha-value.md) — minutes · `tailwind.config.ts:23` · 227 dead classes, 37 files
- [x] **02** [Fix month navigation off-by-one](02-calendar-month-nav.md) — minutes · `CalendarView.tsx:175`
- [x] **03** [One shared, gap-tolerant `calcStreak`](03-streak-mismatch.md) — ~45min · `Shell.tsx:82` + `StatsView.tsx:25` · 47 vs 22 on one screen
- [x] **04** [Fix the Scratchpad flush effect](04-scratchpad-autosave-deps.md) — ~30min · `Scratchpad.tsx:168`
- [x] **05** [Lifts "All-time" must not be a 90-day window](05-lifts-all-time-window.md) — minutes · `LiftTracker.tsx:57` · 7 of 36 entries
- [x] **06** [Re-entrancy guards on the completion toggles](06-toggle-reentrancy-guards.md) — ~30min · `TasksView.tsx:170`, `HabitsView.tsx:188`
- [x] **07** [Fix the HAE instructions in the empty state](07-health-empty-state-instructions.md) — minutes · `HealthEmptyState.tsx:19`

## Risks — correct today, wrong under a condition that will occur

- [x] **08** [Deleting a habit rewrites its history](08-habit-deleted-at.md) — ~1h · `schema.prisma` · needs `ALTER TABLE`
- [x] **09** [Strain's 21-day strip ignores the selected day](09-strain-strip-selected-day.md) — ~30min · `BevelStrain.tsx:30`
- [x] **10** [CalendarView needs an `AbortController`](10-calendar-abortcontroller.md) — ~30min · `CalendarView.tsx:161`
- [x] **11** [14 mutations ignore `res.ok`](11-unchecked-res-ok.md) — ~2h · `CalendarView`, `LiftTracker`
- [x] **12** [`ImportStatus` needs a `source: "other"` branch](12-import-status-source.md) — ~20min · `ImportStatus.tsx:66` · **blocks the automation question**
- [x] **13** [Trend charts are unreadable on a phone](13-trendchart-phone.md) — ~1h · `ui/TrendChart.tsx` · 3.16px text, no touch
- [x] **14** [`MetricRow` clips at iPad-portrait width](14-metricrow-ipad-clip.md) — ~30min · 768–819px
- [x] **15** [Collapse the four score-colour ladders](15-score-colour-ladders.md) — ~2h
- [x] **16** [Restore `prefers-reduced-motion` or delete the comment](16-prefers-reduced-motion.md) — ~1h · `globals.css:356`
- [x] **17** [Rewrite or delete `docs/DESIGN.md`](17-design-md-stale.md) — ~2h · Connor chose **delete**, done 2026-08-12
- [x] **18** [Add a linter and a test gate](18-no-lint-or-test-gate.md) — ~1h · `package.json`
- [x] **19** [Batch `recomputeDerived`'s writes](19-recompute-derived-batching.md) — ~45min · ⚠️ **do this before the 2026-06-01 → 08-10 backfill**
- [x] **20** [Bring `scripts/` under the gate](20-scripts-outside-gate.md) — ~1h · 4 of 8 scripts never reviewed
- [x] **21** [Three server "today" helpers return UTC](21-server-today-utc.md) — ~45min
- [x] **22** [Score non-recurring tasks from `completedAt`](22-completed-at-unread.md) — ~1h
- [x] **23** [`matchesPattern` swallows an unknown type](23-matches-pattern-default.md) — ~20min · `lib/recurring.ts`
- [x] **24** [Give `Task` a `startDate`](24-task-start-date.md) — ~45min · 0 rows affected today

## Cleanups — no behaviour change

- [x] **25** [The orrery gate can never be false](25-orrery-gate-and-bundle.md) — superseded 2026-08-12: Connor had the **orrery removed entirely** (`three`/`@react-three/*` uninstalled)
- [x] **26** [Delete `docs/BEVEL-OPEN-ISSUES.md`](26-delete-bevel-open-issues.md) — minutes
- [x] **27** [Relocate `plan.md`, re-point 6 citations](27-relocate-plan-md.md) — ~45min · ⚠️ 2 cite it by line number
- [x] **28** [Retire `update.md`, keep its deferred block](28-retire-update-md.md) — ~15min
- [x] **29** [Remove `pg`, `@types/pg`, the Neon script](29-remove-pg-and-neon-script.md) — ~15min
- [x] **30** [Pin Prisma for real, or stop saying "pinned"](30-prisma-pin-wording.md) — minutes
- [x] **31** [Drop the fixed Scratchpad claim from 2 docs](31-stale-scratchpad-claim.md) — minutes

## Rule challenge

- [ ] **32** [`dev\TRAPS.md:220` misattributes PWA staleness](32-traps-service-worker-mechanism.md) — ~15min · advice right, mechanism wrong · **edits a file outside this repo**

## Suggested order

1. **01** first and alone — one token, whole-app contrast, and it changes what every
   later visual check is looking at.
2. Then **02, 05, 07** — minutes each, no shared surface.
3. Then **19** before Connor sends the long raw export, or the backfill times out.
4. Then **12**, which is the only thing standing between you and an answer on whether
   the HAE automation runs unattended.
5. **03, 08** touch the same score denominators — do them together, and re-read the
   declined item above before you go near them.

## Not in this queue

The 12 entries in `../overnight/rejected.md` were investigated and killed with evidence — they
are not pending work, and per that file they are not re-raised without new evidence.

⚠️ The run-3 brief's **"Also noticed"** list — ~17 small observations that were never
promoted to findings — was lost when `brief.md` was retired on 2026-08-10. Some of it
survives inside `../overnight/audits/NNN-*.md`; none of it was ever approved, so nothing in
this queue depends on it.
