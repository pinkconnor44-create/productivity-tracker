# Productivity Tracker

Next.js 16 App Router · React 19 · TS · Prisma + libSQL (Turso) · Tailwind · PWA.
Charts are hand-rolled SVG — no libraries, so they stay on the design tokens.

Tabs: `tasks | habits | bevel | stats | calendar | projects | settings`.
**Bevel** is the Apple Watch health tab (Dashboard / Sleep / Recovery / Strain /
**Lifts** / Trends) — the Lift Tracker lives inside it, with no tab of its own.

- **Dark-only.** `dark` is hard-coded on `<html>`. Do **not** add `dark:`
  prefixes. There is **no accent-theme switcher** — it was deleted, nothing sets
  `data-theme` any more, and the `accent-theme` localStorage key is inert.
- **3D is desktop-only and gated.** `three` + `@react-three/*` power only the
  calendar orrery: dynamic import, `ssr:false`, IntersectionObserver-gated —
  **never the initial bundle, never a phone.**

## Repo layout

`src/app/` App Router + `api/` handlers · `src/components/` views + `Shell.tsx`
· `bevel/` sub-tabs · `src/lib/` (`prisma`, `recurring`, `toast`, `health`,
`health-import`) · **`prisma/schema.prisma` is the single source of truth.**

**Use `src/components/ui/` primitives** rather than building local copies —
they route through the semantic token ladder so the palette stays consistent
(`Card`, `StatCard`, `Ring`, `MetricRow`, `TrendChart`, `kindColors`,
`metricColors`, `useConfirm`, and the rest — read the folder).

## Health / Bevel

- **`POST /api/health-import` is the only authenticated route in the app.**
  `X-Api-Key` vs `HEALTH_IMPORT_KEY`; **fails closed** — 500 if unset, 401 on
  mismatch. One parser serves both the live phone automation and the historical
  backfill, deliberately: one set of timezone assumptions.
- **`toLocalDay()` is `slice(0,10)`, not `Date` parsing.** HAE sends
  `"2026-01-21 06:00:00 -0400"` and with *Aggregate: Days* that prefix is
  already the phone's local day. Parsing to a `Date` and reading UTC fields
  pushes evening entries onto the next day. **Highest-risk assumption in the
  import path** — raw timestamps are stored so history can be reprocessed.
- **A missing score is `null`, never `0`.** A missing HRV reading is not a bad
  recovery day; the Ring draws null as a dashed state.
- Tables: `HealthMetricDaily` (`@@unique([date, metric])`), `SleepSession`
  (`date @unique`, keyed on the **wake** day), `HealthWorkout`
  (`externalId @unique` = idempotency key). Baselines computed on the fly, and
  every weight lives in `HEALTH_CONSTANTS` (`src/lib/health.ts`).
- ⚠️ **Preview and prod share one Turso DB.** Run
  `node scripts/wipe-health-fixtures.mjs --yes` before the first real backfill,
  or demo HRV lands in the same trailing baselines as real readings.

## Deployment

`npx vercel --prod` — **not** connected to GitHub auto-deploy, always manual.
Build is `prisma generate && next build`; the schema is **no longer pushed at
build time**, so run `npm run db:push` before any deploy with schema changes.
Env: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `DATABASE_URL=file:./prisma/dev.db`
(typegen only, never queried), `HEALTH_IMPORT_KEY`. Prod:
`productivity-tracker-murex.vercel.app`.

## Design tokens (Void / Electric Iris)

Defined in `globals.css`, surfaced via `tailwind.config.ts`. Full spec in
`docs/DESIGN.md`.

- **Surfaces** `bg-surface` (#000) → `bg-surface-container-*` (#030304 → #1d1d25).
  Hairline is `border-outline-variant/40`.
- **The rgb tuples MUST stay space-separated.** Tailwind emits
  `rgb(var(--x) / <alpha>)`; mixing commas with the slash is invalid CSS and
  **silently falls back to white**.
- **One curated palette.** `primary-*` is Electric Iris (`#8052ff` at 500),
  `accent-*` is Saffron Spark. Use `primary-*`, never `violet-*`.
- **Metric triad:** Sleep = Iris, Strain = Saffron, Recovery = green. Brand
  colours, not decoration.
- **Type scale and radius ladder are semantic** — prefer them over arbitrary
  values. Cards `2xl`, StatCards `xl`.
- **`.glass` is 62% opaque** (`rgba(13,13,17,0.62)`) + 24px blur. Declare
  `-webkit-backdrop-filter` **before** the standard property, or the optimiser
  drops the standard one.
- Background blooms are **static on purpose** — animating full-viewport layers
  behind `backdrop-filter` forces a per-frame re-blur.

## Conventions

- **Every delete goes through `useConfirm()`.** No `window.confirm`, no inline
  `setConfirming` toggles — even for checklist items.
- **Page wrapper is `min-h-screen md:flex`**, never plain `flex`: the mobile
  `<header>` is a flex sibling of `<main>` and would sit beside it.
- **`hover:` never fires on touch** (`future.hoverOnlyWhenSupported`). Use
  `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`; never gate primary
  actions behind hover.
- **Outside-click needs `mousedown` AND `touchstart`** (mobile Safari).
- **Any ancestor with a `transform` traps `position: fixed`** — `.neon-card:hover`
  does exactly that. Portal tooltips to `document.body`.
- **Optimistic writes use functional updaters** `setX(prev => …)`, never
  closure-captured state, plus a debounced PATCH, an `AbortController` and an
  unmount `keepalive` flush.
- **Completion windows:** cap denominators to the item's start date.
- **Schema changes:** edit `schema.prisma` → `npm run db:push` (additive only).
  Destructive changes are hand-written SQL. Adapter major must match
  `@prisma/client` (both pinned `5.22.0`); `@libsql/client` in `0.3.5–0.8.x`.

**See also:** `HANDOFF.md` · `docs/NOTES.md` · `docs/DESIGN.md` · `dev\TRAPS.md`
