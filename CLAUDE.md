# Productivity Tracker

Next.js 16 App Router · React 19 · TS · Prisma + libSQL (Turso) · Tailwind · PWA.
Charts are hand-rolled SVG — no libraries, so they stay on the design tokens.
Tabs: `tasks | habits | bevel | stats | calendar | projects | settings`.
**Bevel** is the Apple Watch health tab (Dashboard / Sleep / Recovery / Strain /
**Lifts** / Trends) — the Lift Tracker lives inside it, with no tab of its own.

- **Dark-only.** `dark` is hard-coded on `<html>`; do **not** add `dark:`
  prefixes. There is **no accent-theme switcher** — it was deleted, nothing
  sets `data-theme`, and the `accent-theme` localStorage key is inert.
- **3D is desktop-only and gated.** `three` + `@react-three/*` power only the
  calendar orrery: dynamic import, `ssr:false`, IntersectionObserver-gated —
  **never the initial bundle, never a phone.**

## Repo layout

`src/app/` App Router + `api/` · `src/components/` views + `Shell.tsx` ·
`bevel/` sub-tabs · `src/lib/` · **`prisma/schema.prisma` is the source of
truth.** `scripts/` holds the health backfill/wipe/fit tools.

**Use `src/components/ui/` primitives** rather than local copies — they route
through the semantic token ladder so the palette stays consistent (`Card`,
`StatCard`, `Ring`, `MetricRow`, `TrendChart`, `useConfirm`, … read the folder).

## Health / Bevel

- **`POST /api/health-import` is the only authenticated route.** `x-api-key`
  (name fixed, casing free) vs `HEALTH_IMPORT_KEY`, both trimmed; **fails
  closed**. Rejections are logged too — an empty log used to mean both "nothing
  arrived" and "arrived and was turned away". One parser serves the phone
  automation and the backfill: one set of timezone assumptions.
- **`toLocalDay()` is `slice(0,10)`, not `Date` parsing.** With *Aggregate:
  Days* that prefix is already the phone's local day; parsing to a `Date` and
  reading UTC fields pushes evening entries onto the next day. Confirmed
  against Apple Health 2026-08-07. Raw timestamps are stored regardless.
- **A missing score is `null`, never `0`.** A missing HRV reading is not a bad
  recovery day; the Ring draws null as a dashed state.
- Tables: `HealthMetricDaily` (`@@unique([date, metric])`), `SleepSession`
  (`date @unique`, keyed on the **wake** day), `HealthWorkout`
  (`externalId @unique` = idempotency key). Baselines computed on the fly.
- **`HEALTH_CONSTANTS` is a FITTED artefact, not free parameters.** Every value
  was calibrated against nine days of Bevel's own scores on 2026-08-09.
  **Never hand-tune one** — add days to `BEVEL` in `scripts/fit-bevel.mjs` and
  re-run, which reprints every constant and its residual. Consequences worth
  knowing: sleep is duration-only (stage mix had no measurable effect), strain
  is an **absolute** load scale rather than relative to your own baseline, and
  recovery scores the day's **minimum** heart rate — Apple's resting HR
  correlates with Bevel's recovery at the *wrong sign*.
- **Recovery cannot fully match Bevel without sleep-window readings** — no
  reweighting substitutes. See `RECOVERY_LIMIT` in `lib/health.ts`.
- ⚠️ **Preview, prod and local dev share one Turso DB.** A test row written
  from `npm run dev` is a real row in production data.

## Deployment

`npx vercel --prod` — **not** GitHub auto-deploy, always manual. Build is
`prisma generate && next build`; the schema is **not** pushed at build time, so
run `npm run db:push` before any deploy with schema changes.
Env: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `HEALTH_IMPORT_KEY`, and
`DATABASE_URL=file:./prisma/dev.db` (typegen only). Prod:
`productivity-tracker-murex.vercel.app`.

## Design tokens (Void / Electric Iris)

In `globals.css` via `tailwind.config.ts`. Full spec in `docs/DESIGN.md`.
- **The rgb tuples MUST stay space-separated.** Tailwind emits
  `rgb(var(--x) / <alpha>)`; mixing commas with the slash is invalid CSS and
  **silently falls back to white**.
- **One curated palette.** `primary-*` is Electric Iris (`#8052ff` at 500),
  `accent-*` is Saffron Spark. Use `primary-*`, never `violet-*`.
- **Metric triad:** Sleep = Iris, Strain = Saffron, Recovery = green.
- **Type scale and radius ladder are semantic** — prefer them to arbitrary
  values. Cards `2xl`, StatCards `xl`.
- **`.glass` is 62% opaque** + 24px blur; declare `-webkit-backdrop-filter`
  **before** the standard property or the optimiser drops the standard one.
- Background blooms are **static**: animating layers behind `backdrop-filter`
  forces a per-frame re-blur.

## Conventions

- **Every delete goes through `useConfirm()`** — no `window.confirm`, no inline
  `setConfirming` toggles, even for checklist items.
- **Page wrapper is `min-h-screen md:flex`**, never plain `flex` — the mobile
  `<header>` is a flex sibling of `<main>` and would sit beside it.
- **`hover:` never fires on touch** (`future.hoverOnlyWhenSupported`) — use
  `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`, and never gate a
  primary action behind hover.
- **Outside-click needs `mousedown` AND `touchstart`** (mobile Safari).
- **Any ancestor with a `transform` traps `position: fixed`** — `.neon-card:hover`
  and `.tab-fade` both do. Portal tooltips to `document.body`.
- **Optimistic writes use functional updaters** `setX(prev => …)`, never
  closure-captured state, plus a debounced PATCH, an `AbortController` and an
  unmount `keepalive` flush. **Completion windows** cap denominators to the
  item's start date.
- **Schema changes:** edit `schema.prisma` → `npm run db:push` (additive only);
  destructive ones are hand-written SQL. Adapter major must match
  `@prisma/client` (both pinned `5.22.0`); `@libsql/client` `0.3.5–0.8.x`.

**See also:** `HANDOFF.md` · `docs/NOTES.md` · `docs/DESIGN.md` · `dev\TRAPS.md`
