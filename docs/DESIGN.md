# Lumina Design System

Productivity Tracker uses the **Lumina** design system: a deep-space, glassmorphic, dark-only aesthetic built on Material 3 surface ladder principles with a vibrant violet → blue gradient accent.

> **Brand personality:** Effortless Precision. Targets high-performance professionals who value aesthetic beauty and functional speed. Calm control amidst a busy schedule, with a futuristic deep-space atmosphere that makes time-management feel premium.

---

## Visual Foundations

### Color Palette — "Midnight Spectrum"

Built on near-black navy for maximum neon contrast. All values defined as CSS custom properties in `src/app/globals.css` and surfaced as Tailwind utilities via `tailwind.config.ts`.

#### Surface Ladder (M3 elevation)

| Token | Hex | Usage |
|-------|-----|-------|
| `surface-container-lowest` | `#060e20` | Deepest base / page background |
| `surface-container-low` | `#131b2e` | Secondary sections, footer |
| `surface` | `#0b1326` | Default surface |
| `surface-container` | `#171f33` | Card backgrounds, input fields |
| `surface-container-high` | `#222a3d` | Elevated cards |
| `surface-container-highest` | `#2d3449` | Highest elevation, popovers |
| `surface-bright` | `#31394d` | Borders, subtle highlights |

#### Accent (theme-driven)

5 user-selectable accent themes via `[data-theme="X"]` on `<html>`:
- **violet** (default) `#8B5CF6`
- **green**, **red**, **pink**, **cyan**

Each exposes:
- `--c-p` (rgb triplet)
- `--c-p-hex`
- `--c-g-mid`, `--c-g-end` (gradient stops)

Persisted to `localStorage('accent-theme')`. Tailwind `violet-*` utilities are intercepted by `[data-theme]` overrides in `globals.css` to swap accent dynamically.

#### Text & Borders

| Token | Hex | Usage |
|-------|-----|-------|
| `on-surface` | `#dae2fd` | Primary text, headings |
| `on-surface-variant` | `#cbc3d7` | Secondary text, captions |
| `outline-variant` | `var(--c-p) @ low alpha` | Default border |
| `outline` | `var(--c-p) @ med alpha` | Stronger border |

> **Important:** `border-outline*` utilities are forced to dark accent shade via `!important` rules in `globals.css`. Tailwind's `/40` `/60` alpha modifier is bypassed; alpha is hardcoded per class. Add new alpha variants by appending to the override block.

Status tints use semantic alpha: `bg-{emerald,amber,rose,blue}-500/{10,15,20}`. **Never** use `bg-emerald-50` or `bg-emerald-900/20` — light/dark composites are gone.

---

### Typography — Dual-Font Strategy

Loaded via `next/font/google` in `layout.tsx`, exposed as `--font-display` / `--font-body`.

- **Space Grotesk** (display) — geometric, technical, futuristic. Tight tracking on headlines for a "locked-in" professional look.
- **Manrope** (body) — high legibility, modern proportions. Generous line-height keeps the airy minimalist feel.

#### Scale

| Variant | Size | Weight | Leading | Tracking |
|---------|------|--------|---------|----------|
| headline-xl | 64px | 700 | 1.1 | -0.02em |
| headline-lg | 48px | 600 | 1.2 | — |
| headline-md | 32px | 500 | 1.3 | — |
| body-lg | 18px | 400 | 1.6 | — |
| body-md | 16px | 400 | 1.5 | — |
| label-sm | 12px | 600 | 1 | 0.05em |

---

### Glassmorphism Recipe

`.glass` utility class:
- Background: **92% opaque slate** (NOT 60% — over the aurora orbs + dot-grid bg, 60% reads as transparent)
- `backdrop-filter: blur(20px)`
- 1px top-edge inner highlight (white @ 20% alpha) — simulates light hitting the edge
- Subtle 1px outer border

`.neon-card` adds:
- Hover bloom (colored outer glow)
- `translateY(-2px)` lift on hover

---

### Elevation & Depth

Hierarchy via **glassmorphism + tonal layering**, not traditional shadows.

1. **Backdrop blur** — high-elevation modals/dropdowns: 20px blur, 92% opaque slate
2. **Inner glow** — 1px top-border @ 20% white opacity = light catching glass edge
3. **Outer glow** — primary buttons & "now" indicators: `box-shadow: 0 0 15px <accent>` makes them feel luminous
4. **Z-axis depth** — background elements blur deeper than foreground for naturalistic focus

---

### Shape Language

Consistently rounded — no sharp corners, premium feel.

| Token | Value | Usage |
|-------|-------|-------|
| sm | 0.25rem | Micro elements |
| DEFAULT | 0.5rem | Inputs, small buttons |
| md | 0.75rem | Medium cards |
| lg | 1rem | Large cards |
| xl | 1.5rem | Hero containers, layout cards |
| full | 9999px | Pills, avatars |

---

### Layout & Spacing

- **Grid:** 12-column, centered, `max-width: 1280px`
- **Base unit:** 4px (mathematical harmony)
- **Gutter:** 24px
- **Margin:** 48px
- **Stack:** `stack-sm` 8px / `stack-md` 16px / `stack-lg` 32px

Vertical rhythm is intentionally spacious — `stack-lg` between sections lets the gradient/blur breathe. Calendar and other data-dense areas tighten to `stack-sm` for density without losing clean gutters.

---

## Component Guidelines

### Buttons

**Primary** (`.btn-primary`)
- Violet → blue gradient (135° linear)
- White text, semibold
- 0.5rem radius
- Hover: brightness up + outer bloom intensifies (`shadow: 0 0 20px rgba(139,92,246,0.5)`)

**Ghost** (`.btn-ghost`)
- Transparent + 1px `outline-variant` + glass blur
- Hover: bg shifts to `rgba(255,255,255,0.05)`

### Cards & Containers

All cards use `.glass` (or `.neon-card` for hover-interactive):
- 92% opaque dark
- 1px subtle top-border highlight
- 20px backdrop blur
- Background neon gradients peek through subtly without distracting

### Inputs (`.input-glass`)

- Deep recessed bg (`surface-container-lowest`)
- Slight inner shadow
- Border glows accent on focus
- Placeholder text dimmed

### Navigation

Top bar: floating glass with `backdrop-blur-md`. Nav links use `on-surface-variant`, shift to `on-surface` on hover with a small accent dot indicator. Pill indicator on primary tab bar animates via `tabRefs` + `getBoundingClientRect`.

### Calendar Events

Event blocks use semi-transparent versions of accent + secondary. Active "now" event gets a pulsing neon dot (`.neon-pulse` keyframe).

### Chips & Badges

Pill-shaped, high-contrast, slight glow. Stand out against glass card backgrounds.

---

## Motion

- **Transitions:** `300ms cubic-bezier(0.4, 0, 0.2, 1)` on all interactive elements
- **Micro-interactions:** subtle 1.02x scale-up on `.neon-card` hover
- **Lift:** `translateY(-2px)` on `.neon-card:hover` (creates new stacking context — see gotcha below)

---

## Gotchas

- **Dark-only:** `dark` class is hard-coded on `<html>`. **Do not add `dark:` Tailwind prefixes** — they were stripped repo-wide.
- **Hover on touch:** Tailwind config has `future.hoverOnlyWhenSupported: true` — `hover:` styles do NOT apply on touch devices. Required for single-tap toggles on mobile.
- **Stacking context trap:** `position: fixed` is trapped by any ancestor with a CSS `transform`. `.neon-card:hover` uses `translateY(-2px)` → tooltips inside `.neon-card` must be lifted to component root or rendered via `createPortal(node, document.body)`. See `MonthView` in `src/components/CalendarView.tsx`.
- **Glass opacity:** `.glass` is 92% opaque, not 60%.
- **Accent overrides:** `border-outline*` and accent utility alphas are hardcoded in `globals.css`. Tailwind's alpha modifier is bypassed for these.
