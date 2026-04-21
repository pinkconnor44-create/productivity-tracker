# About Me

I am a very analytical person who likes concise output with no nonsense. 

# Rules

- Always ask clarifying questions before starting a complex task
- show plan and steps before executing
- keep reports and summaries concise (bullets before paragraphs)
- save all outputs to the output folder
- cite all sources when doing research
- Environment: Use '.env' for API keys; never hardcode

# 🎯 PROJECT-SPECIFIC: Productivity Tracker

# Context & Goals
- Personal productivity tracker deployed to Vercel, tracking tasks, habits, lifts, and daily score over time

# Tech Stack
- Next.js 16 App Router, React 19, TypeScript
- Prisma ORM + PostgreSQL (Neon hosted)
- Tailwind CSS — no UI component libraries
- No charting libraries — SVG charts built inline
- Deployed to Vercel (prod alias: productivity-tracker-murex.vercel.app)

# Features
- Tasks, Habits, Lift Tracker, Inbox, Eisenhower Matrix, Notes, Scratchpad, Weekly Review, Daily Score
- PWA-enabled (manifest + service worker)
- Dark/light mode via localStorage + `dark` class on `<html>`

# Data / API
- All data via /api/* route handlers using Prisma
- Scores computed server-side in /api/scores
- Gmail import endpoint at /api/gmail-import

# Deployment
- Deploy with: `npx vercel --prod`
- Env vars live in .env (never commit) — also set in Vercel dashboard
- Build runs: `prisma generate && prisma db push && next build`

