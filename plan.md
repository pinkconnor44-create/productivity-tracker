# Bevel Health Tab + Apple Watch Data — productivity-tracker

> Approved plan, saved 2026-07-21 for later implementation. **Not yet executed.**
> Note: an Ultraplan cloud session is also executing a refined copy of this plan
> remotely — results will land as a GitHub PR. When that PR arrives (or the
> session is teleported back), diff it against this file and merge refinements.

## Context
Connor wants two things in `C:\dev\Code\Coding_Projects\productivity-tracker`:
1. A **"Bevel" tab** that recreates the Bevel Health iOS app inside the tracker — sub-tabs with Bevel's surfaces (Dashboard score rings, Sleep, Recovery, Strain, Trends/Timeline), fed by his **Apple Watch** data.
2. A **light app-wide visual polish** (Bevel-style rings adopted where scores show today).

Data path (decided): **Health Auto Export** iOS app (Premium, ~$24.99 lifetime) auto-POSTs JSON to a new endpoint. **Historical backfill: yes.** **Reversibility is mandatory** — everything must be cleanly revertible if Connor dislikes it.

Bevel's Nutrition and Biological Age features are omitted (need data we don't collect); noted as future.

Also decided (Connor, 2026-07-21):
- **Lifts tab removed** — the existing LiftTracker moves *inside* the Bevel tab as a "Lifts" sub-tab (Bevel has a strength tracker, so it belongs there). All lift data, groups, drafts, and the floating stopwatch are preserved — this is a relocation, not a rewrite.
- **Scratchpad tab removed** — the Scratchpad embeds into the main Calendar tab.
- **Mobile parity is a first-class requirement** — everything must work on desktop and on his iPhone PWA (dedicated phase below).

## Needed from Connor (only external dependencies)
- Buy **Health Auto Export — JSON+CSV** (App Store), Premium tier (~$24.99 lifetime or $5.99/yr; 7-day trial exists).
- When I say so: configure one REST API automation in it (I'll give exact URL/header/settings) and run the manual exports for backfill.
- Review the **Vercel preview URL** on his phone before anything touches prod.

## Reversibility guarantees (design constraints)
- All work on branch **`feature/bevel-health`**; main untouched until approval.
- Deploys are **preview-only** (`npx vercel`) until Connor approves; prod stays as-is (deploys are manual in this project — no auto-deploy exists).
- DB: **new tables only** (`HealthMetricDaily`, `SleepSession`, `HealthWorkout`); push script is verified additive-only; existing tables never modified.
- Full rollback: delete branch (pre-merge) or `git revert` + `npx vercel --prod` / Vercel Instant Rollback (post-merge); DB revert = `DROP TABLE` × 3; phone revert = delete the HAE automation. `HEALTH_IMPORT_KEY` env var is inert and can stay.
- Nav restructure (Lifts/Scratchpad tabs removed) deletes **zero data and zero components** — LiftTracker and Scratchpad, their APIs, and DB tables are untouched; only their mount points move. A code revert restores the old tabs exactly (nav-order localStorage self-heals in both directions — auto-appends new ids, filters removed ones).

## Phases

### Phase 0 — Branch + secret
- `git checkout -b feature/bevel-health`
- Generate `HEALTH_IMPORT_KEY` (random 32-byte hex) → `.env` + Vercel dashboard (all envs).

### Phase 1 — DB schema (additive)
Append 3 models to `prisma/schema.prisma` (project conventions: String `"YYYY-MM-DD"` dates, JSON-as-String):
- `HealthMetricDaily` — `@@unique([date, metric])`, `qty`/`min`/`avg`/`max`/`units` (daily aggregates for ~12 metrics: HR, resting HR, HRV, respiratory rate, active/basal energy, exercise min, stand hours, steps, VO2max, SpO2).
- `SleepSession` — `date @unique` (wake day), start/end, stage minutes (inBed/asleep/core/deep/rem/awake), `raw` JSON.
- `HealthWorkout` — `externalId @unique` (idempotency), date, type, start/end, durationMin, activeKcal, avgHr, maxHr, distanceKm, `raw` JSON.

Daily aggregates only in v1 (no minute-level samples); baselines computed on the fly (no baseline table). Apply with `npm run db:push`.

### Phase 2 — `POST /api/health-import` (first authed endpoint in the app)
New: `src/app/api/health-import/route.ts` + `src/lib/health-import.ts` (pure parser, testable).
- Auth: `X-Api-Key` header vs `HEALTH_IMPORT_KEY` (fail closed: 500 if env unset, 401 on mismatch). No middleware — self-contained, matching the app's no-middleware pattern.
- Parses HAE v2 payload `{data:{metrics:[{name,units,data:[{date, qty|Min/Avg/Max}]}], workouts:[...]}}`; dates like `"2026-01-21 06:00:00 +0000"` → day via `toLocalDay()` = `slice(0,10)`.
- `sleep_analysis` → SleepSession upsert; all other metrics → HealthMetricDaily upsert (unknown metric names stored generically — nothing lost); workouts → HealthWorkout upsert on externalId.
- Fully **idempotent** (pure upserts; HAE delivery is opportunistic/duplicated). Chunked `prisma.$transaction`. Skips bad points (counted), never 500s mid-batch. `maxDuration = 60`.
- Verify with curl fixtures: 200 + counts; re-POST → unchanged rows; wrong key → 401.

### Phase 3 — Read API + scores
New: `GET /api/health?start&end` (`src/app/api/health/route.ts`, pattern copied from `api/scores/route.ts`) + `src/lib/health.ts` (documented pure functions).
- Fetches range −60d for baselines; returns per-day `{metrics, sleep, workouts, scores:{sleep, recovery, strain}}` + baselines.
- **Baselines**: 30-day trailing mean (excl. today); < 7 days data → "Calibrating · N/30 days".
- **Sleep score** = 0.70·duration(vs 8h) + 0.15·deep% (target 15%) + 0.15·REM% (target 20%).
- **Recovery** = 0.5·HRV-vs-baseline + 0.3·restingHR-vs-baseline + 0.2·last-night sleep score (piecewise-linear anchors; missing components renormalize).
- **Strain** = 0.6·(activeKcal/baseline) + 0.4·(exerciseMin/baseline), scaled so baseline day ≈ 67, capped 100.
- Constants named in one file — tuning later is a one-file change.

### Phase 4 — Frontend: Ring primitive + BevelView
- **`src/components/ui/Ring.tsx`** (net-new; no ring exists in the app): SVG progress ring, `strokeDasharray/offset`, round caps, 12-o'clock start, animated fill, `scoreColor()` default, null → dashed "—" state. Export from `ui/index.ts`.
- **`src/components/BevelView.tsx`** + `src/components/bevel/*`; one `useHealthData` hook (AbortController, `score-refresh` listener), data passed to sub-tabs as props. Sub-tab segmented control copies StatsView's range-picker styling (`StatsView.tsx:306-310`). Sub-tabs: **Dashboard · Sleep · Recovery · Strain · Lifts · Trends**.
  - **Dashboard**: 3 hero Rings (Recovery/Sleep/Strain) + StatCard grid (HRV, RHR, steps, kcal, exercise min, resp rate, SpO2, VO2max) with Δ-vs-baseline subs.
  - **Sleep**: night Ring + stacked stage bar (status-tint colors) + duration trend + history.
  - **Recovery**: Ring + HRV/RHR trend charts w/ baseline line + component breakdown.
  - **Strain**: Ring + today's workouts list + active-energy bar history.
  - **Lifts**: the existing `<LiftTracker/>` rendered unchanged as a sub-tab (same component, same APIs/data). Re-gate the floating stopwatch from `tab === 'lifts'` to `tab === 'bevel'` (recent commit gated it to the Lifts tab). LiftTracker's internal state survives sub-tab switches because BevelView keep-mounts sub-tab panels (hidden-div pattern, same as Shell).
  - **Trends**: metric picker + generalized TrendChart (copy of `StatsView.tsx:51-127` with dynamic y-domain), weekly-comparison cards, `DayTimeline` (chronological sleep→workouts list for a picked day).
  - **Empty state** (Bevel's own first-run weakness): onboarding card with numbered HAE setup steps; loading skeletons; "Calibrating" rings.
- **Wiring / nav restructure**: `Shell.tsx` Tab union (~L23): add `'bevel'`, **remove `'lifts'` and `'scratchpad'`**; NAV_ITEMS (~L38): add `{id:'bevel', label:'Bevel', icon:<IconBevel/>}`, remove the Lifts and Scratchpad entries; wide-container check (L348) → `bevel` wide; `page.tsx` views map → add `bevel: <BevelView/>`, remove `lifts`/`scratchpad` entries. Nav-order localStorage is safe both ways: loadOrder auto-appends new ids and filters removed ones (verified).
- **Scratchpad → Calendar tab**: embed the existing `<Scratchpad/>` component inside CalendarView — a collapsible `.glass` section below the month grid on mobile, side/below placement on desktop depending on space. Component and its API (`/api/scratchpad`) unchanged; only its mount point moves. Its drafts/state survive tab switches via Shell's keep-mounted pattern (CalendarView never unmounts).
- Follow repo conventions: dark-only, violet-* for accent, portal tooltips inside `.neon-card`, mousedown+touchstart, no hover-gated actions on touch.

### Phase 5 — Live sync + backfill
- HAE automation: POST → `https://productivity-tracker-murex.vercel.app/api/health-import`, header `X-Api-Key`, JSON, **Aggregate: Days**, hourly cadence; metrics list + workouts enabled.
- **Backfill via the same endpoint** (one code path, idempotent): HAE manual "Export Now" per month; fallback `scripts/backfill-health.mjs` (reads exported JSON file, POSTs ~2MB chunks with the key, re-runnable).
- Verify: Turso row counts; spot-check 3 days against the Apple Health app; re-run a chunk → unchanged.

### Phase 6 — App-wide polish (light)
- Shell `TodayWidget` (Shell.tsx:395): big % number + bar → Ring (~48px) + streak chip.
- StatsView hero: headline avg score → medium Ring beside the StatCard strip.
- Nothing else restyled; no theme/token changes. (CalendarView strip deferred — noted as follow-up.)

### Phase 7 — Mobile implementation + cross-device QA
Everything must work on desktop **and** Connor's iPhone PWA. Build responsive from the start, then a dedicated QA pass:
- **Bevel layouts**: Dashboard hero = 3 rings side-by-side on desktop (`sm:+`), horizontally scrollable or 1-large + 2-small stack on mobile; StatCard grid `grid-cols-2 sm:grid-cols-4`; sub-tab bar horizontally scrollable (`overflow-x-auto`, no wrap) on narrow screens; charts use full-width responsive SVG viewBoxes (existing TrendChart pattern already scales).
- **Touch rules (repo conventions)**: no hover-gated actions (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`); outside-click handlers register `mousedown` + `touchstart`; chart tooltips get touch fallback (tap = select point); portal tooltips for anything inside `.neon-card`.
- **Scratchpad-in-Calendar on mobile**: collapsed by default under the month grid so the calendar stays above the fold; body-scroll behavior unchanged.
- **Lifts sub-tab on mobile**: verify the floating stopwatch drag + persistence and stacked-set drafts still work inside BevelView (pointer-event code is layout-independent, but re-test).
- **QA checklist** on the Vercel preview from the iPhone PWA: all 6 Bevel sub-tabs render + scroll correctly; rings animate; calendar + embedded scratchpad usable; nav drawer shows new tab set; no horizontal page scroll anywhere; Lighthouse/quick perf sanity on the Bevel tab.

### Phase 8 — Approval gate
Connor reviews preview URL on phone → approve → merge → `npx vercel --prod` → reopen PWA once (sw is network-first; low stale-JS risk).

## Verification
- `npm run build` after each phase; `rtk`-prefixed commands unavailable on this machine (plain git).
- Phase 2/3: curl fixture POSTs (valid / duplicate / bad-key / garbage) + curl the read API, hand-check one day's scores.
- Phase 4: `npm run dev` walkthrough of all sub-tabs with fixture data; `npx vercel` preview on phone (touch behavior).
- Phase 5: DB spot-checks vs Apple Health app.

## Key risks
- **Timezones** (HAE `+0000` timestamps vs local days) — single `toLocalDay()` helper; inspect first live payload and adjust once; raw timestamps stored for reprocessing. Highest-risk item.
- HAE payload drift (qty vs Min/Avg/Max, sleep field names) — parser normalizes casings, keeps `raw` JSON, never 500s.
- Preview & prod share one Turso DB — wipe fixture rows (`DELETE FROM` new tables) before backfill.
- Scores are approximations of Bevel's proprietary ones — tunable constants in `src/lib/health.ts`.

## Files
**Modified**: `prisma/schema.prisma`, `src/components/Shell.tsx`, `src/app/page.tsx`, `src/components/StatsView.tsx`, `src/components/CalendarView.tsx` (embed Scratchpad), `src/components/ui/index.ts`, `.env`. (`LiftTracker.tsx` / `Scratchpad.tsx` reused as-is, only remounted.)
**New**: `src/app/api/health-import/route.ts`, `src/app/api/health/route.ts`, `src/lib/health-import.ts`, `src/lib/health.ts`, `src/components/ui/Ring.tsx`, `src/components/BevelView.tsx`, `src/components/bevel/*`, `scripts/backfill-health.mjs`.

---

# STATUS 2026-08-07 — parked

Phases A (tokens/radius/motion/extractions) and B-core (void black + Electric
Iris, accent-theme system deleted) are **done and deployed to prod**.

## Parked in storage — do not start without Connor saying so
- **C0–C3 · data pipeline** — the 3 Prisma models, `POST /api/health-import`,
  `GET /api/health` + `src/lib/health.ts` scoring. Everything in Phases 1–3
  above still stands as written.
- **C4 · Bevel tab** — BevelView, its 6 sub-tabs, and the 7 new primitives
  (`MetricRow`, `StatusChip`, `RangeGauge`, `SegmentedBar`, `InsightCard`,
  3-ring cluster). `Ring` is being built early for C6, so C4 inherits it.
- **C5** — Health Auto Export purchase + phone automation. Blocked on Connor.

Nothing about these is stale; they were deprioritised in favour of making the
app *look* finished first, which needs none of them.

## Backlog — depth / hero imagery (Connor, 2026-08-07)
Explicitly "don't make it yet, keep it in mind."

Add depth behind each screen instead of a flat panel-on-black look: large,
low-opacity 3D/landscape imagery acting as a hero backdrop — the reference is
Bevel's Sleep detail screen, where the ring sits over a photographic night
mountain range that fades into the surface.

Notes for whoever picks this up:
- The glass layer already in place is the right substrate — translucent panels
  over a photographic backdrop is exactly what that screenshot does.
- Watch page weight. The Website Scraper research (`the-stack.md`) measured
  photography at ~94% of page weight on a comparable build; this is a PWA that
  loads on mobile data.
- Backdrop imagery must not defeat text contrast. Bevel gets away with it via a
  heavy dark gradient scrim between photo and content.
- Per-screen art direction is the interesting question: one shared hero, or a
  different landscape per tab (calendar/lifts/stats)?
