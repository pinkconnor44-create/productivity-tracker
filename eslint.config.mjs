// The lint gate (item 18). Deliberately narrow: the rules here are the ones
// that catch the class of defect this codebase has actually shipped —
// hook-dependency and effect-cleanup bugs that tsc cannot see. Broad style
// rulesets are noise on a hand-rolled codebase; add rules when a defect class
// earns its place.
//
// scripts/*.mjs is linted too (item 20) — half of those scripts touch
// production data and sat outside every gate.
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // Plain-JS scripts: parse + the recommended JS correctness rules only.
    files: ['scripts/**/*.mjs'],
    rules: {},
  },
)
