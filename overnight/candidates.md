# Candidates — productivity-tracker
_Enumerated 2026-08-10 · scope: **blanket** · N = 32, set by Connor_
_Surveyed: 612,382 bytes (100% of areas reached by at least one pass)_

Phase 1 output. **Unverified by design** — guessed severities carry `?`. `/audit`
assigns one agent per item; a candidate that turns out to be wrong is a
successful candidate and becomes a `rejected.md` entry with evidence.

⚠️ **Read `rejected.md` first.** It holds 12 killed items and 1 item Connor
declined — none of them may be re-enumerated or promoted.

---

## Candidates

- [ ] **001** `bug?` — `tailwind.config.ts:23` — `on-surface-variant` is declared
      without `<alpha-value>`, so every `text-on-surface-variant/NN` class may
      emit nothing. **Unverified.** Audit question: do those classes exist in the
      built CSS, and what colour do the labels actually compute to?
- [ ] **002** `bug?` — `CalendarView.tsx:175` — `navigate()` calls `setMonth`
      before `setDate(1)`. **Unverified.** Audit question: execute it from the
      31st of a month — does it land on the intended month?
- [ ] **003** `bug?` — `Shell.tsx:82` + `StatsView.tsx:25` — two separate streak
      walks over the same `/api/scores` data. **Unverified.** Audit question: run
      both over the real scores — do they agree, and are both on screen at once?
- [ ] **004** `bug?` — `Scratchpad.tsx:168` — a cleanup-only effect keyed
      `[notes]`. **Unverified.** Audit question: which value does each POST
      carry, and does the debounce ever fire?
- [ ] **005** `bug?` — `LiftTracker.tsx:57` — the fetch sends a 90-day query
      string while the UI is labelled "All-time". **Unverified.** Audit question:
      how many of the stored lift entries fall inside that window?
- [ ] **006** `bug?` — `TasksView.tsx:170`, `HabitsView.tsx:188` — completion
      toggles with no re-entrancy guard, against toggle endpoints.
      **Unverified.** Audit question: what happens on a double tap, and does
      `CalendarView` guard the same endpoints?
- [ ] **007** `bug?` — `HealthEmptyState.tsx:19` — the HAE setup instructions
      shown to the user. **Unverified.** Audit question: do they match the
      `Aggregate Data` setting `CLAUDE.md` now requires, or the one that
      destroyed the 2026-08-08→10 totals?
- [ ] **008** `risk?` — `prisma/schema.prisma` + `api/scores` — `Habit` deletion
      sets `active:false` with no date column. **Unverified.** Audit question:
      does deleting a habit change historical scores, and how many rows are
      affected today?
- [ ] **009** `risk?` — `BevelStrain.tsx:30` — the 21-day strip's date range.
      **Unverified.** Audit question: with a past day selected, does the strip
      follow the selection or stay anchored to today?
- [ ] **010** `risk?` — `CalendarView.tsx:161` — the score/notes refetch effect.
      **Unverified.** Audit question: is there an `AbortController` or a key
      check, and what does a late response do to a month's cells?
- [ ] **011** `risk?` — `CalendarView.tsx:226-278`, `LiftTracker.tsx:708-729` —
      mutation calls and their toasts. **Unverified.** Audit question: how many
      ignore `res.ok`, and does any of them toast success on a failure?
- [ ] **012** `risk?` — `ImportStatus.tsx:66` — the "from phone / manual
      backfill" line. **Unverified.** Audit question: render it against the real
      last import — can it actually answer whether the automation ran unattended?
- [ ] **013** `risk?` — `ui/TrendChart.tsx` — a `viewBox`-scaled SVG chart.
      **Unverified.** Audit question: measure the rendered font size at 390px,
      and check whether any touch handler exists.
- [ ] **014** `risk?` — `ui/MetricRow` — the label column at tablet widths.
      **Unverified.** Audit question: sweep 360→1440 and find the widths, if any,
      where the label clips.
- [ ] **015** `risk?` — score colours are defined in more than one place
      (`ui/index.ts`, `CalendarView`, `StatsView`). **Unverified.** Audit
      question: do any two co-rendered elements paint the same score differently?
- [ ] **016** `risk?` — `globals.css:356` — a comment referring to a
      `prefers-reduced-motion` block. **Unverified.** Audit question: does the
      block exist, and how many infinite animations run without an opt-out?
- [ ] **017** `risk?` — `docs/DESIGN.md`, cited by `CLAUDE.md` as "Full spec".
      **Unverified.** Audit question: how many of its statements still match the
      CSS after the 2026-08-06 palette rework?
- [ ] **018** `risk?` — `package.json` — the automated gate. **Unverified.**
      Audit question: is there a linter or test script at all, and what class of
      defect in this codebase would `react-hooks/exhaustive-deps` catch?
- [ ] **019** `risk?` — `api/health-import/route.ts:330` — `recomputeDerived`'s
      write loops. **Unverified.** Audit question: are they batched like the
      other write paths, and what happens on a multi-day payload inside
      `maxDuration = 60`?
- [ ] **020** `risk?` — `tsconfig.json` — `include` and `checkJs`.
      **Unverified.** Audit question: is anything under `scripts/` type-checked,
      and which of those scripts touch production data?
- [ ] **021** `risk?` — `api/scores`, `api/health`, `api/tasks/[id]` — three
      server-side "today" helpers, one named `localDateString`. **Unverified.**
      Audit question: which timezone do they resolve to on Vercel, and does any
      caller depend on the server value?
- [ ] **022** `risk?` — `api/scores:69` — non-recurring tasks scored from an
      undated boolean while `Task.completedAt` exists. **Unverified.** Audit
      question: does anything read `completedAt`, and does a late completion
      rewrite a past day's score?
- [ ] **023** `risk?` — `lib/recurring.ts:57` — `matchesPattern` ends
      `default: return false` while the schema advertises `monthly`.
      **Unverified.** Audit question: can the UI produce `monthly`, and what
      happens to a task that carries it?
- [ ] **024** `risk?` — `lib/recurring.ts:23` — tasks fall back to
      `createdAt` where habits have a `startDate` column. **Unverified.** Audit
      question: how many live rows sit on the fallback, and are any affected?
- [ ] **025** `cleanup?` — `orrery/OrreryHero.tsx:36` — an IntersectionObserver
      gate on the WebGL bundle. **Unverified.** Audit question: can the gate ever
      be false given the default tab, and how large is the chunk really?
- [ ] **026** `cleanup?` — `docs/BEVEL-OPEN-ISSUES.md`. **Unverified.** Audit
      question: are its issues still open, and does it contradict `HANDOFF.md`?
- [ ] **027** `cleanup?` — `plan.md` (repo root). **Unverified.** Audit question:
      who cites it, does anything in it still describe unbuilt work, and does it
      contradict `CLAUDE.md`?
- [ ] **028** `cleanup?` — `update.md` (repo root). **Unverified.** Audit
      question: is anything in it the only live copy of something?
- [ ] **029** `cleanup?` — `package.json` + `scripts/migrate-from-neon.mjs` —
      `pg` and `@types/pg`. **Unverified.** Audit question: is Neon still used
      anywhere?
- [ ] **030** `cleanup?` — `CLAUDE.md` Conventions says the Prisma packages are
      "both pinned `5.22.0`". **Unverified.** Audit question: does `package.json`
      agree, and does the stated invariant still hold if not?
- [ ] **031** `cleanup?` — `HANDOFF.md` and `docs/BEVEL-QA.md` both list a
      Scratchpad hover item as outstanding. **Unverified.** Audit question: does
      the code already satisfy it?
- [ ] **032** `cleanup?` — `dev\TRAPS.md:220` attributes PWA staleness to the
      service worker. **Unverified.** Audit question: does `public/sw.js`
      actually cache anything? ⚠️ This one edits a file **outside this repo** —
      if it survives, the work order must say so.

## Not surveyed

- `scripts/seed-health-fixtures.mjs`, `wipe-health-fixtures.mjs`,
  `push-schema.mjs`, `smoke-test.mjs` (~10 KB) — never read.
- `ProjectsView.tsx`, `SettingsView.tsx` beyond greps and the autosave path.
- Accessibility beyond contrast and touch targets — no screen-reader pass.
- Runtime performance profiling.
