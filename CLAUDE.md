# Productivity Tracker

Next.js 16 App Router · React 19 · TS · Prisma + libSQL (Turso) · Tailwind · PWA.
Charts are hand-rolled SVG — no libraries, so they stay on the design tokens.
Tabs: `tasks | habits | bevel | stats | calendar | projects | settings`. **Bevel**
is the Apple Watch health tab (Dashboard / Sleep / Recovery / Strain / **Lifts**
/ Trends) — the Lift Tracker lives inside it, with no tab of its own.

- **Dark-only.** `dark` is hard-coded on `<html>`; do **not** add `dark:`
  prefixes. **No accent-theme switcher** — nothing sets `data-theme`, and the
  `accent-theme` localStorage key is inert.
- **3D is desktop-only and gated.** `three` + `@react-three/*` power only the
  calendar orrery: dynamic import, `ssr:false`, IntersectionObserver-gated —
  **never the initial bundle, never a phone.**
- **`schema.prisma` is the source of truth.** Layout is conventional Next.js.
- **Use `src/components/ui/` primitives**, not local copies — they route through
  the semantic token ladder so the palette stays consistent (read the folder).

## Health / Bevel

- **`POST /api/health-import` is the only authenticated route.** `x-api-key`
  vs `HEALTH_IMPORT_KEY`, both trimmed; **fails closed**. Rejections are logged
  too — an empty log used to mean both "nothing arrived" and "turned away at
  the door". One parser serves the phone and the backfill.
- **`toLocalDay()` is `slice(0,10)`, not `Date` parsing** — that prefix is
  already the phone's local day; parsing to a `Date` and reading UTC fields
  pushes evening entries onto the next day. **A missing score is `null`, never
  `0`**. ⚠️ **Preview, prod and dev share one Turso DB** — a row written from
  `npm run dev` is a real row in production data.
- ⚠️ **HAE must export `Aggregate Data` OFF, `Export Period` = Today.** "Since
  Last Sync" sends an hour's readings *labelled with the day*, overwriting each
  total with a sliver; aggregated export has no timestamps, so no recovery.
- Tables: `HealthMetricDaily` (`@@unique([date, metric])`), `SleepSession`
  (`date @unique`, **wake** day, carrying that night's `sleepHr/sleepHrv/
  sleepResp`), `HealthSample` (`@@unique([metric, start, source])`),
  `HealthWorkout` (`externalId @unique`). Baselines computed on the fly.
- **Strain needs `min>=90bpm`** from samples, not energy alone; `2026-08-07`
  resists every feature and is held out of the fit.
- **Daily rows are DERIVED from sub-daily readings** — SUM for totals, AVERAGE
  for vitals (`CUMULATIVE_UNITS` in `health-import.ts`). Only `heart_rate`,
  `heart_rate_variability` and `respiratory_rate` are also kept as samples:
  Watch-only, and recovery needs a sleep window of them. **The importer never
  shrinks a total or a night**; `X-Import-Mode: replace` (backfill) lifts that.
- **`HEALTH_CONSTANTS` is a FITTED artefact. Never hand-tune one** — add days
  to `BEVEL` in `scripts/fit-bevel.mjs`, re-run against a raw-sample export,
  paste. Sleep is duration-only; strain is an **absolute** load scale; recovery
  uses **no sleep duration** — only sleeping HR/HRV/respiratory rate, compared
  against trailing **MEDIANS** (one HRV artefact skews a mean for a month).
- **Recovery is locked to last night by construction, not a stored flag** —
  every input sits inside the sleep window, so nothing after waking moves it.
  Don't add a daytime reading back in; that was the bug, and the score decayed
  all afternoon. Our sleep-window mean HR **is** Bevel's sleeping bpm (0.10 bpm
  / 9 nights); baseline *history* is what is short: `RECOVERY_LIMIT`.

## Deployment

`npx vercel --prod` — **not** GitHub auto-deploy, always manual. Build is `prisma
generate && next build`; the schema is **not** pushed at build time, so run `npm run
db:push` before any deploy with schema changes. Env: `TURSO_DATABASE_URL`,
`TURSO_AUTH_TOKEN`, `HEALTH_IMPORT_KEY`, `DATABASE_URL=file:./prisma/dev.db`
(typegen only). Prod: `productivity-tracker-murex.vercel.app`.

## Design tokens (Void / Electric Iris)

`globals.css` via `tailwind.config.ts`. **Full spec in `docs/DESIGN.md`.**
- **The rgb tuples MUST stay space-separated.** Tailwind emits
  `rgb(var(--x) / <alpha>)`; commas with the slash are invalid CSS and
  **silently fall back to white**.
- **One curated palette.** `primary-*` is Electric Iris, `accent-*` Saffron
  Spark — never `violet-*`. Triad: Sleep = Iris, Strain = Saffron, Recovery =
  green. Type/radius ladders are semantic; Cards `2xl`, StatCards `xl`.
- **`.glass`**: declare `-webkit-backdrop-filter` **before** the standard one or
  the optimiser drops it. Blooms are **static** — animating behind
  `backdrop-filter` forces a per-frame re-blur.

## Conventions

- **Approved work lives in `new changes/`** (`/audit` writes it) — a candidate or an
  audit is a proposal; only that folder is built. `overnight/rejected.md` is final.
- **Every delete goes through `useConfirm()`** — no `window.confirm`, no inline
  `setConfirming` toggles, even for checklist items.
- **Page wrapper is `min-h-screen md:flex`**, never plain `flex` — the mobile
  `<header>` is a flex sibling of `<main>` and would sit beside it.
- **Any ancestor with a `transform` traps `position: fixed`** — `.neon-card:hover`
  and `.tab-fade` both do. Portal tooltips to `document.body`.
- **`hover:` never fires on touch** (`future.hoverOnlyWhenSupported`) — use
  `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`, and never gate a
  primary action behind hover. Outside-click needs `mousedown` **and**
  `touchstart` (mobile Safari).
- **Optimistic writes use functional updaters** `setX(prev => …)`, never
  closure-captured state, plus a debounced PATCH, an `AbortController` and an
  unmount `keepalive` flush. Completion windows cap denominators to the item's
  start date.
- **Schema changes:** edit `schema.prisma` → `npm run db:push` (additive only);
  destructive ones are hand-written SQL. Adapter major must match
  `@prisma/client` (both pinned `5.22.0`); `@libsql/client` `0.3.5–0.8.x`.
  ⚠️ **`db:push` only emits `CREATE TABLE`** (its diff is `--from-empty`), so a
  new COLUMN is silently "skipped (already existed)" — use `ALTER TABLE`.

**See also:** `HANDOFF.md` · `docs/NOTES.md` · `docs/DESIGN.md` · `dev\TRAPS.md`
