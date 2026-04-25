# About Me
Analytical, concise, no nonsense.

# Rules
- Ask clarifying questions before complex tasks; show plan before executing
- Bullets over paragraphs; cite sources in research
- Never hardcode secrets — use `.env`

# Productivity Tracker

**Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma + PostgreSQL (Neon), Tailwind CSS
- No UI component libraries; SVG charts only (no chart libraries)
- PWA (manifest + service worker); dark/light mode via `dark` class on `<html>` + localStorage

**Features:** Tasks, Habits, Lift Tracker (with workout groups), Inbox, Eisenhower Matrix, Notes, Scratchpad, Weekly Review, Daily Score

**Data:** All data via `/api/*` route handlers (Prisma). Scores: `/api/scores`. Gmail import: `/api/gmail-import`

**Deployment**
- `npx vercel --prod` — Vercel is NOT connected to GitHub auto-deploy; always deploy manually
- Build: `prisma generate && prisma db push && next build`
- Env vars in `.env` (never commit) + Vercel dashboard
- Prod: `productivity-tracker-murex.vercel.app`

**Gotchas**
- Next.js 16: route handler `params` is `Promise<{...}>` — always `await params`
- Schema changes auto-migrate via `prisma db push` on build (no migration files needed)
- `position: fixed` gets trapped by any ancestor with a CSS `transform` — `.neon-card:hover` applies `translateY(-2px)`, creating a new stacking context. Tooltips inside `.neon-card` must be lifted to the component root level to render correctly
- Completion window denominators must be capped to the item's start date (`habitStart`), not the full window size — use `max(windowStart, habitStart)` as the cursor start
- SVG chart tooltips: use `onMouseEnter`/`onMouseMove` on a `<g>` with a transparent hit-area circle (`r="8"`, `fill="transparent"`) over the visible dot

