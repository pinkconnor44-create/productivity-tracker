# 07 — The app instructs the user to re-break their data

**Severity** bug · **Effort** minutes · **Approved** 2026-08-10
**Source** run-3 finding 12 · evidence `../overnight/audits/020-ui-render-sweep.md`

## Change

Rewrite the Health Auto Export setup instructions to match the rule in `CLAUDE.md`:
`Aggregate Data` **OFF**, `Export Period` = **Today**, finest time grouping.

## Where

`src/components/bevel/HealthEmptyState.tsx:19`

## Why

It currently tells the user to set HAE's `Aggregate → "Days"`. That is the exact
setting `CLAUDE.md` and `HANDOFF.md` now say must be **OFF** — it is what destroyed
every daily total on 2026-08-08 → 08-10. An aggregated export carries no
timestamps, so there is no recovery from it.

## Verify

The rendered empty state and `CLAUDE.md` state the same three settings.
