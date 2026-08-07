import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  future: { hoverOnlyWhenSupported: true },
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        'surface-dim': 'var(--surface-dim)',
        'surface-bright': 'var(--surface-bright)',
        'surface-container-lowest': 'var(--surface-container-lowest)',
        'surface-container-low': 'var(--surface-container-low)',
        'surface-container': 'var(--surface-container)',
        'surface-container-high': 'var(--surface-container-high)',
        'surface-container-highest': 'var(--surface-container-highest)',
        'on-surface': 'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
        outline: 'rgb(var(--outline-rgb) / <alpha-value>)',
        'outline-variant': 'rgb(var(--outline-variant-rgb) / <alpha-value>)',
        // Electric Iris. Shaped deliberately like Tailwind's violet ramp so the
        // `violet-N` -> `primary-N` sweep is a 1:1 rename that preserves all 7
        // shades in use and the 20 base/hover pairs that differ only by shade.
        // Collapsing these to one colour would silently kill every button hover.
        // DEFAULT is a plain hex, not rgb(var(--c-p) / <alpha>): --c-p is
        // comma-separated (rgba() needs that) and mixing commas with the slash
        // is invalid CSS. There is no theming left to justify the indirection.
        primary: {
          DEFAULT: '#8052ff',
          50: '#f2eeff',
          100: '#e6ddff',
          200: '#cdbaff',
          300: '#b096ff',
          400: '#9873ff',
          500: '#8052ff', // Electric Iris — the brand anchor
          600: '#6d3ae8',
          700: '#5a2cc4',
          800: '#47219c',
          900: '#351a73',
          950: '#1f0f45',
        },
        // Saffron Spark — second accent. Strain in the Bevel triad.
        accent: {
          DEFAULT: '#ffb829',
          50: '#fff8eb',
          100: '#ffefcc',
          200: '#ffdd99',
          300: '#ffcb5c',
          400: '#ffb829',
          500: '#f5a300',
          600: '#cc8600',
          700: '#a36a00',
          800: '#7a4f00',
          900: '#523500',
        },
        secondary: 'var(--secondary)',
        'secondary-container': 'var(--secondary-container)',
      },
      // Semantic scale. Deliberately does NOT reuse Tailwind's xs/sm/base/lg
      // names — redefining those would move 200+ existing call sites and this
      // step must be pixel-identical. Views migrate onto these during B-sweep.
      // Sizes chosen from what the app actually uses: it is micro-label dense
      // (10px x77, 11px x67, 12px x91, 14px x94), not headline-driven.
      fontSize: {
        micro: ['0.625rem', { lineHeight: '1' }],        // 10px — eyebrows, chips
        tiny: ['0.6875rem', { lineHeight: '1.1' }],      // 11px — secondary micro
        caption: ['0.75rem', { lineHeight: '1.4' }],     // 12px
        body: ['0.875rem', { lineHeight: '1.5' }],       // 14px — default body
        'body-lg': ['1rem', { lineHeight: '1.5' }],      // 16px
        title: ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        headline: ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'display-sm': ['1.875rem', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
        display: ['2.25rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        // Hero metrics — net new. Nothing in the app currently exceeds 36px;
        // Bevel's ring centres and big-number cards need to go bigger.
        metric: ['3rem', { lineHeight: '1', letterSpacing: '-0.035em' }],
        'metric-lg': ['4rem', { lineHeight: '1', letterSpacing: '-0.04em' }],
      },
      boxShadow: {
        // Real glass: white top-edge highlight + depth. Replaces the hand-written
        // inset strings in Card/StatCard and the accent-tinted one in .glass.
        glass: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.6)',
        'glass-lg': 'inset 0 1px 0 0 rgba(255,255,255,0.08), 0 16px 48px rgba(0,0,0,0.7)',
        glow: '0 0 20px rgba(128,82,255,0.35)',
        'glow-lg': '0 0 40px rgba(128,82,255,0.28)',
        // Bevel's sparkline end-dot bloom.
        dot: '0 0 8px 2px currentColor',
      },
      transitionTimingFunction: {
        // Emil-style: fast out, settled in. Replaces ad-hoc cubic-beziers.
        snap: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      // A ladder that actually ascends. Previously `2xl` was never declared, so
      // it fell through to stock Tailwind's 1rem while `lg` was also overridden
      // to 1rem and `xl` to 1.5rem — meaning rounded-lg (59 uses) and
      // rounded-2xl (31) rendered identically, and rounded-xl (48) was LARGER
      // than rounded-2xl. Card used 2xl and StatCard used xl, so every StatCard
      // was rounder than the Card containing it.
      //
      // Correcting the ladder needs no call-site changes: Card's `2xl` lands on
      // 24px (the reference brief's card radius) and StatCard's `xl` on 16px,
      // which reverses the inversion by itself. rounded-xl at 24px was also
      // over-round on the many w-8 h-8 icon buttons that use it.
      borderRadius: {
        sm: '0.25rem',     // 4
        DEFAULT: '0.375rem', // 6
        md: '0.5rem',      // 8
        lg: '0.75rem',     // 12
        xl: '1rem',        // 16
        '2xl': '1.5rem',   // 24 — cards
        '3xl': '2rem',     // 32
      },
      maxWidth: {
        container: '1280px',
      },
    },
  },
  plugins: [],
}
export default config
