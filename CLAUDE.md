# About Me
Analytical, concise, no nonsense.

# Rules
- Ask clarifying questions before complex tasks; show plan before executing
- Bullets over paragraphs; cite sources in research
- Never hardcode secrets — use `.env`

# Productivity Tracker

## Stack
- Next.js 16 App Router · React 19 · TypeScript · Prisma + libSQL/SQLite (Turso) · Tailwind CSS
- No UI component libraries; SVG charts only (no chart libraries)
- PWA (`public/manifest.json` + `public/sw.js`)
- **Dark-only** Lumina design system — `dark` class hard-coded on `<html>`. Do **not** add `dark:` Tailwind prefixes.
- Fonts via `next/font/google` in `layout.tsx`: Space Grotesk (display, `--font-display`) + Manrope (body, `--font-body`)

## Features
Tasks (with `kind` tag: meeting / focus / personal / admin / planning), Habits, Lift Tracker (workout groups + draggable floating timer + stacked-set drafts), Notes, Scratchpad (own page), Weekly Review, Daily Score, Projects, Stats (includes 365-day heatmap inside StatsView)

## Repo layout
- `src/app/` — Next.js App Router (pages, layout, API routes)
- `src/app/api/` — route handlers: tasks, habits, lifts, lift-groups, projects, scratchpad, notes, scores, weekly-review, gmail-import, pwa-icon, shutdown, plus completion/skip endpoints
- `src/components/` — view components (CalendarView, TasksView, HabitsView, LiftTracker, ProjectsView, StatsView, WeeklyReview, SettingsView, Scratchpad, ToastContainer, PWASetup) + `Shell.tsx` (sidebar/drawer chrome)
- `src/components/ui/` — shared design primitives. Use these instead of building local copies — they route through the Lumina semantic ladder so accent themes flow through automatically:
  `PageHeader`, `StatCard`, `Card`, `Section`, `KindChip`, `KindPicker`, `WeightChip`, `Checkbox`, `Eyebrow`, `Hairline`, `kindColors`, `scoreColor`, `ConfirmProvider` + `useConfirm`
- `src/lib/` — `prisma.ts` (singleton client), `recurring.ts` (date-pattern helpers), `toast.ts` (window-event toast dispatcher)
- `prisma/schema.prisma` — single source of truth. After editing, run `npm run db:push` to apply the schema to Turso (regenerates `prisma/schema.sql` and pushes via `scripts/push-schema.mjs`). The Vercel build no longer auto-pushes — push manually before deploy.
- `docs/DESIGN.md` — design system spec

## Shell (`src/components/Shell.tsx`)
- Desktop: 240px fixed sidebar (`md:+`) — logo + Today widget (score % + 🔥 streak) + flat draggable nav + footer (Settings + Power)
- Mobile: hamburger drawer; top bar shows greeting + streak chip; backdrop / Esc closes; body-scroll-locks while open
- Single flat nav list (no section labels). Order persists to `localStorage('nav-order-v1')`. Reorder uses pointer-event long-press (350ms) — works on both mouse and touch. Settings + Power anchored in footer, not draggable.
- Tabs: `tasks | habits | lifts | stats | calendar | projects | weekly-review | scratchpad | settings`
- **Lazy-mount + keep-mounted**: views render in `<div className={tab===activeTab ? '' : 'hidden'}>` once visited and never unmount on tab switch. State survives nav (Lifts stopwatch, scratchpad drafts, in-progress edits). Cost: concurrent fetches once a view's been opened.
- **Z-index ladder**: aurora `-10` / content `0` / sidebar `30` / mobile drawer `40` / modals (createPortal at body) `50` / Floating Stopwatch `55` / toasts + portal tooltips `60`
- `score-refresh` window event dispatched on every tab change so any view listening to it refetches

## Data
All data via `/api/*` route handlers (Prisma). Scores: `/api/scores`. Gmail import: `/api/gmail-import`. Task `kind` is a UI tag (5 enum values, optional, nullable) on the Task model — POST + PATCH `/api/tasks` accept it.

## Deployment
- `npx vercel --prod` — Vercel is **not** connected to GitHub auto-deploy; always deploy manually
- Build: `prisma generate && next build` (schema is no longer pushed at build time — push manually with `npm run db:push` before deploys that include schema changes)
- Env vars in `.env` (never commit) + Vercel dashboard. Required: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `DATABASE_URL=file:./prisma/dev.db` (typegen-only, not used at runtime).
- Prod URL: `productivity-tracker-murex.vercel.app`

## Design tokens (Lumina, M3-style)
Defined in `src/app/globals.css`, surfaced as Tailwind classes via `tailwind.config.ts`.
- **Surfaces**: `bg-surface` (#0b1326 navy), `bg-surface-container-{lowest,low,'',high,highest}` (M3 elevation)
- **Text**: `text-on-surface` (primary), `text-on-surface-variant` (secondary)
- **Borders**: `border-outline-variant` (default), `border-outline`. **Forced to dark-accent shade** via `!important` rules in `globals.css` using `rgba(var(--c-p), <alpha>)`. Tailwind alpha modifiers (`/40`, `/60`) are bypassed for these — alpha is hardcoded per class. Add new alpha variants by appending to the override block.
- **Accent themes** (5): violet (default), green, red, pink, cyan. Switched via `[data-theme="X"]` on `<html>`; persisted to `localStorage('accent-theme')`. CSS custom properties `--c-p` (rgb triplet), `--c-p-hex`, `--c-g-mid`, `--c-g-end` drive everything. Violet utilities (`text-violet-400`, `bg-violet-500/15`, etc.) are intercepted by `[data-theme]` overrides to swap accent — so use violet utilities for accent-colored UI, not raw hex.
- **Status tints**: use semantic alpha (`bg-{emerald,amber,rose,blue}-500/{10,15,20}`) — never `bg-emerald-50` or `bg-emerald-900/20`.
- **Utility classes**: `.glass` (92% opaque slate + 20px backdrop-blur + inner top-edge highlight), `.neon-card` (hover bloom + lift), `.btn-primary` (gradient + outer bloom), `.btn-ghost`, `.input-glass`, `.neon-pulse` (keyframe for "now" indicators)

## Conventions

### Deletes
**Every delete action must go through `useConfirm()`** (`src/components/ui/ConfirmDialog.tsx`). The `<ConfirmProvider>` is mounted once in `app/layout.tsx`. Pattern:
```tsx
const confirm = useConfirm()
const ok = await confirm({ title: 'Delete X?', message: <>…</>, confirmLabel: 'Delete' })
if (!ok) return
// perform delete
```
Defaults to danger styling. Never fire a delete immediately — even small ones (checklist items, lift sessions). No `window.confirm`, no inline `setConfirming` toggles.

### Page wrapper layout
`page.tsx` uses `<div className="min-h-screen md:flex">` — block on mobile, flex on desktop. **Do not** use plain `flex`. The mobile `<header>` is a flex sibling of `<main>`; with plain `flex` they sit side-by-side instead of stacked, squishing the main column.

### Hover styles
Tailwind has `future.hoverOnlyWhenSupported: true` — `hover:` styles do **not** apply on touch devices. For action buttons that should be visible on mobile but hover-revealed on desktop, use `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`. Don't gate primary actions behind hover.

### Outside-click handlers
Register both `mousedown` AND `touchstart` — mobile Safari does not synthesize `mousedown` from touch reliably.

### `position: fixed` + transforms
Any ancestor with a CSS `transform` traps `position: fixed`. `.neon-card:hover` applies `translateY(-2px)`, creating a stacking context. Tooltips inside `.neon-card` must be lifted to component root **or** rendered via `createPortal(node, document.body)`. Calendar's month-cell hover popover uses the portal pattern.

### `.glass` opacity
`.glass` is 92% opaque (not 60% as the original DESIGN spec suggested). Over the aurora orbs + dot-grid background, 60% reads as transparent. Keep it solid.

### SVG chart tooltips
Use `onMouseEnter` / `onMouseMove` on a `<g>` with a transparent hit-area circle (`r="8"`, `fill="transparent"`) over the visible dot.

### SVG axis colors
Chart axis labels should use `fill="var(--c-p-hex)"` so they recolor with accent theme. Don't use Tailwind `fill-*` classes for accent-colored SVG text.

### Kind colors
`src/components/ui/kindColors.ts` deliberately uses indigo/cyan/pink/amber/slate (NOT violet) so `[data-theme]` accent overrides don't recolor task tags when the user switches accents.

### Optimistic-write debounced PATCH (ProjectsView pattern)
Every mutation must use functional updater `setProjects(prev => ...)` (NOT closure-captured state) to avoid stale-read races on rapid edits. Pair with: (a) debounced server PATCH, (b) `AbortController` to cancel in-flight requests when newer data arrives, (c) `pendingX` ref + unmount cleanup that fires `keepalive: true` fetch to flush last edit if the user navigates away mid-debounce. Auto-resize textareas inside portals must trigger `adjustHeight()` via `requestAnimationFrame` on `modalOpen` change — DOM isn't measurable until next paint.

### Completion windows
Denominators must be capped to the item's start date — use `max(windowStart, habitStart)` as the cursor start. Never use the full window size for items that didn't exist for the whole window.

## Component-specific notes

### CalendarView
- Month + week cells show kind-colored task pills. Mobile (`<sm`): up to 3 pills, start time only via `shortTime()` helper (e.g., `9a`, `9:30a`, `12p`, `2:30p`), untimed tasks show a tiny kind dot. Tablet+ (`sm:`): same pill plus truncated title. `+N more` footer when length > 3.
- Pill must be a `<div>` (not `<span>`) with `overflow-hidden` so `truncate` clips against the column. Use `max-w-full sm:w-full` so pills size to content on mobile but stretch on desktop. Parent column uses `items-start`.
- Pill text scales with breakpoint: `text-[7px] sm:text-[10px]` with `px-0.5 sm:px-1 py-px`.
- 4-card stat strip (Day / Week / Month / Year) at top. YearSpine only on `xl:+`.
- `shortTime(t)` is the canonical compact time format for narrow contexts (<50px). `formatTime()` is for day-detail and tooltips where space isn't constrained.

### LiftTracker
- 2-layer navigation: `activeGroupId === null` = Layer 1 (workout day cards), `number` = Layer 2 (exercises in that day), `'ungrouped'` = Layer 2 ungrouped list. `AddExerciseToGroup` handles autocomplete add at the bottom of Layer 2.
- Floating Stopwatch state must live in `LiftTracker` via `useStopwatchState()` hook, **not** in the inner `<FloatingStopwatch>`. Otherwise it resets on layer change. The widget's DOM remounts in each layer's return path, but state survives because the hook is owned by the parent.
- Floating Stopwatch is draggable via pointer events; position persists to `localStorage('stopwatch-pos-v1')`.
- Lift session drafts: stacked-set inputs in `InlineLogForm` auto-save to `localStorage('lift-draft-{date}-{exerciseName}')` per keystroke. "Finish session" groups consecutive same-weight rows into single `LiftEntry` POSTs (schema is one weight per entry, JSON `[reps]` per set). Always clear the draft after successful submit.

### ProjectsView
List shows project name + N/M checklist progress only. Click card → opens modal (`createPortal` to `document.body`) containing title / notes / checklist / delete. Pattern: any "tab switcher + always-visible detail panel" UI in this repo should be a list-of-cards + modal instead.

## Database (Turso / libSQL)
- Hosted on Turso (managed libSQL — SQLite over the wire). Free tier: 9 GB storage, 500M row reads/mo. Plenty of headroom.
- Runtime queries go through the **Prisma driver adapter** (`@prisma/adapter-libsql` + `@libsql/client`), wired up in `src/lib/prisma.ts`. The schema declares `provider = "sqlite"` with `previewFeatures = ["driverAdapters"]`.
- `DATABASE_URL=file:./prisma/dev.db` exists in `.env` only because Prisma CLI commands (`prisma generate`, `migrate diff`) need a non-libSQL URL during typegen. The file is never created or queried — runtime ignores it and uses `TURSO_DATABASE_URL` via the adapter.
- **Schema changes**: edit `prisma/schema.prisma`, then `npm run db:push`. This regenerates `prisma/schema.sql` from the schema and applies any new statements to Turso via `scripts/push-schema.mjs`. For destructive changes (column drops, type changes), write the migration SQL by hand and apply it manually — the push script only handles additive `CREATE TABLE`/`CREATE INDEX`.
- Adapter version must match `@prisma/client` major. Currently both pinned to `5.22.0`. `@libsql/client` must be in the `0.3.5–0.8.x` range for adapter v5.x compatibility.
- **Temporary**: `scripts/migrate-from-neon.mjs` and the `pg` / `@types/pg` dev-deps exist only as a fallback for the recent Neon→Turso migration. Once the Neon project is decommissioned (planned ~1 week after 2026-05-09), delete the script and `npm uninstall pg @types/pg`.
