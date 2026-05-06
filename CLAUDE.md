# About Me
Analytical, concise, no nonsense.

# Rules
- Ask clarifying questions before complex tasks; show plan before executing
- Bullets over paragraphs; cite sources in research
- Never hardcode secrets — use `.env`

# Productivity Tracker

**Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma + PostgreSQL (Neon), Tailwind CSS
- No UI component libraries; SVG charts only (no chart libraries)
- PWA (manifest + service worker); **dark-only** Lumina design system (no light mode — `dark` class is hard-coded on `<html>`)
- Fonts loaded via `next/font/google` in `layout.tsx`: Space Grotesk (display) + Manrope (body), exposed as `--font-display` / `--font-body`
- Accent themes (5): violet (default), green, red, pink, cyan. Switched via `[data-theme="X"]` on `<html>`; CSS custom properties `--c-p` (rgb), `--c-p-hex`, `--c-g-mid`, `--c-g-end` drive everything. Persisted to `localStorage('accent-theme')`.

**Features:** Tasks (with `kind` tag: meeting/focus/personal/admin/planning), Habits, Lift Tracker (workout groups + draggable floating timer + stacked-set drafts), Notes, Scratchpad (own page), Weekly Review, Daily Score, Projects, Stats (includes 365-day Hotmap)

**Repo layout**
- `src/app/` — Next.js App Router (pages, layout, API routes)
- `src/app/api/` — route handlers: tasks, habits, lifts, lift-groups, projects, scratchpad, notes, scores, weekly-review, gmail-import, pwa-icon, shutdown, plus completion/skip endpoints
- `src/components/` — view components (CalendarView, TasksView, HabitsView, LiftTracker, ProjectsView, StatsView, WeeklyReview, SettingsView, Scratchpad, ToastContainer, PWASetup) + `Shell.tsx` (sidebar/drawer chrome)
- `src/components/ui/` — **shared design primitives**: `PageHeader`, `StatCard`, `Card`, `Section`, `KindChip`, `KindPicker`, `WeightChip`, `Checkbox`, `Eyebrow`, `Hairline`, `kindColors`, `scoreColor`. Use these instead of building local copies — they route through the Lumina semantic ladder so accent themes flow through automatically.
- `src/lib/` — `prisma.ts` (singleton client), `recurring.ts` (date-pattern helpers), `toast.ts` (window-event toast dispatcher)
- `prisma/schema.prisma` — single source of truth; `prisma db push` on build
- `public/` — `manifest.json`, `sw.js`
- `docs/` — design system spec (`DESIGN.md`); the legacy `DESIGN/` folder at repo root holds the React-UMD redesign mocks (kept for reference)

**Shell architecture (`src/components/Shell.tsx`)**
- Desktop: 240px fixed sidebar (md:+) with logo + Today widget (score % + 🔥 streak) + flat draggable nav + footer (Settings + Power)
- Mobile: hamburger drawer; top bar shows greeting + streak chip; backdrop/Esc closes; body-scroll-locks while open
- **Page wrapper layout**: `page.tsx` uses `<div className="min-h-screen md:flex">` — **block on mobile, flex on desktop**. Critical: do NOT use plain `flex` here. On mobile the `<aside>` is hidden (`hidden md:flex`) but the mobile `<header>` is a flex sibling of `<main>`. With plain `flex` they end up side-by-side in a row instead of stacked, squishing the main content into a narrow column. The `md:flex` switch is what makes mobile stack correctly.
- Nav is a **single flat list** (no section labels). Order persists to `localStorage('nav-order-v1')` via HTML5 drag-reorder. Settings + Power are NOT draggable — anchored in the footer.
- Tabs: `tasks | habits | lifts | stats | calendar | projects | weekly-review | scratchpad | settings`
- **Lazy-mount + keep-mounted**: Shell tracks a `mounted: Set<Tab>` and renders each view in a `<div className={tab===activeTab ? '' : 'hidden'}>` once it's been visited. Views never unmount on tab switch — Lifts stopwatch, scratchpad drafts, in-progress edits all survive nav. The cost is concurrent fetches once a view's been opened.
- **Z-index ladder** (documented in Shell.tsx): aurora -10 / content 0 / sidebar 30 / mobile drawer 40 / modals (createPortal at body) 50 / toasts + portal tooltips 60. Floating Stopwatch sits at 55 — above modals, below toasts.
- `score-refresh` window event still dispatched on every tab change so any view listening to it refetches.
- **PageHeader `right` slot** that contains many controls (e.g., Calendar's view-toggle + date nav) should use `flex-wrap` so it wraps onto a second row on narrow viewports instead of overflowing horizontally.

**Data:** All data via `/api/*` route handlers (Prisma). Scores: `/api/scores`. Gmail import: `/api/gmail-import`. Task `kind` is a UI tag (5 enum values, optional) on the Task model — POST + PATCH `/api/tasks` accept it; nullable.

**Deployment**
- `npx vercel --prod` — Vercel is NOT connected to GitHub auto-deploy; always deploy manually
- Build: `prisma generate && prisma db push && next build`
- Env vars in `.env` (never commit) + Vercel dashboard
- Prod: `productivity-tracker-murex.vercel.app`

**Design tokens (Lumina, M3-style)** — defined in `src/app/globals.css`, surfaced as Tailwind classes via `tailwind.config.ts`:
- Surface ladder: `bg-surface` (#0b1326 navy), `bg-surface-container-{lowest,low,'',high,highest}` (M3 elevation levels)
- Text: `text-on-surface` (primary), `text-on-surface-variant` (secondary)
- Borders: `border-outline-variant` (default), `border-outline` — **forced to dark accent shade** via `!important` rules in globals.css using `rgba(var(--c-p), <alpha>)`. Tailwind's alpha modifier (`/40`, `/60`) is bypassed for these utilities; alpha is hardcoded per class in CSS. Add new alpha variants by appending to the override block.
- Primary: `text-violet-400`, `bg-violet-500/15` etc. — violet utilities are intercepted by the `[data-theme="X"]` overrides in globals.css to swap accent
- Use semantic alpha tints for status: `bg-{emerald,amber,rose,blue}-500/{10,15,20}` — never `bg-emerald-50` or `bg-emerald-900/20` (light/dark composites are gone)
- Reusable utility classes: `.glass` (92% opaque slate + 20px backdrop-blur + inner top-edge highlight), `.neon-card` (hover bloom + lift), `.btn-primary` (gradient + outer bloom), `.btn-ghost`, `.input-glass`, `.neon-pulse` (keyframe for "now" indicators)
- DO NOT add `dark:` Tailwind prefixes — dark is the only mode. They were stripped repo-wide.

**Gotchas**
- Tailwind config has `future.hoverOnlyWhenSupported: true` — `hover:` styles do NOT apply on touch devices. Required for single-tap toggles on mobile. Don't rely on hover for primary actions; gate visibility-on-hover only for secondary affordances.
- Next.js 16: route handler `params` is `Promise<{...}>` — always `await params`
- Schema changes auto-migrate via `prisma db push` on build (no migration files needed)
- `position: fixed` gets trapped by any ancestor with a CSS `transform` — `.neon-card:hover` applies `translateY(-2px)`, creating a new stacking context. Tooltips inside `.neon-card` must be lifted to the component root level **or rendered via `createPortal(node, document.body)`** to render correctly. CalendarView's month-cell hover popover uses the portal pattern.
- `.glass` is 92% opaque (not 60% as the original DESIGN spec suggested) — over the aurora orbs + dot-grid background, 60% read as transparent. Keep it solid.
- Completion window denominators must be capped to the item's start date (`habitStart`), not the full window size — use `max(windowStart, habitStart)` as the cursor start
- SVG chart tooltips: use `onMouseEnter`/`onMouseMove` on a `<g>` with a transparent hit-area circle (`r="8"`, `fill="transparent"`) over the visible dot
- Lift Tracker uses 2-layer navigation: `activeGroupId === null` = Layer 1 (workout day cards), `number` = Layer 2 (exercises in that day), `'ungrouped'` = Layer 2 ungrouped list. `AddExerciseToGroup` component handles autocomplete add at the bottom of Layer 2.
- **Floating Stopwatch state must live in `LiftTracker` via `useStopwatchState()` hook**, not in the inner `<FloatingStopwatch>` component. Otherwise it resets on layer change (Layer 1 ↔ Layer 2 ↔ exercise modal). The widget's DOM remounts in each layer's return path, but state survives because the hook is owned by the parent.
- **Lift session drafts**: stacked-set inputs in `InlineLogForm` auto-save to `localStorage('lift-draft-{date}-{exerciseName}')` per keystroke. "Finish session" groups consecutive same-weight rows into single `LiftEntry` POSTs (schema is one weight per entry, JSON `[reps]` per set). Always clear the draft after successful submit.
- Outside-click handlers must register both `mousedown` AND `touchstart` — mobile Safari does not synthesize `mousedown` from touch reliably.
- ProjectsView: list shows project name + N/M checklist progress only. Click card → opens modal (`createPortal` to `document.body`) containing title/notes/checklist/delete. Pattern: any "tab switcher + always-visible detail panel" UI in this repo should be a list-of-cards + modal instead.
- Optimistic-write debounced PATCH pattern (notes/checklist in ProjectsView): every mutation must use `setProjects(prev => ...)` functional updater (NOT closure-captured state) to avoid stale-read races on rapid edits. Pair with: (a) debounced server PATCH, (b) `AbortController` to cancel in-flight requests when newer data arrives, (c) `pendingX` ref + unmount cleanup that fires `keepalive: true` fetch to flush last edit if user navigates away mid-debounce. Auto-resize textareas inside portals must trigger `adjustHeight()` via `requestAnimationFrame` on `modalOpen` change — DOM isn't measurable until next paint.
- **Calendar month cells** show kind-colored task pills (mobile: 1 pill title-only; sm:+ 2 pills with time prefix; "+N more" footer with breakpoint-aware count), score hairline at bottom, amber dot for notes — no full-cell tinted backgrounds, no MiniWheels. The 4-card stat strip (Day/Week/Month/Year) at the top replaces the old 3-wheel column. YearSpine on `xl:+` only. The pill must be a `<div>` (not `<span>`) with `w-full overflow-hidden` so `truncate` actually clips against the column on narrow viewports — `<span>` + `max-w-full` lets text bleed past the border on mobile.
- **Kind colors** (`src/components/ui/kindColors.ts`) deliberately use indigo/cyan/pink/amber/slate Tailwind utilities (NOT violet) so the `[data-theme]` accent overrides in `globals.css` don't recolor task tags when the user switches accents.
- **HotmapView is gone** — its 365-day heatmap lives inside `StatsView` now. Don't add a Hotmap nav item back.
- **Scratchpad is no longer embedded in CalendarView's right rail** — it's its own sidebar item (`Tab = 'scratchpad'`).

**Migration scripts** — `.claude/token-migrate{1..5}.ps1` were one-shot bulk regex passes that converted the legacy light-first slate/white token palette to the Lumina semantic ladder. Kept in tree as historical reference only; no need to re-run them.

