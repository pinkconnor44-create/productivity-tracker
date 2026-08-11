# 22 — Non-recurring tasks are scored by an undated boolean

**Severity** risk · **Effort** ~1h · **Approved** 2026-08-10
**Source** the run-3 review action item (carried from runs 1–2)

## Change

Score non-recurring tasks from `completedAt` instead of the boolean, so completing
one late credits the day it was actually finished.

## Where

`src/app/api/scores/route.ts`; `completedAt` on `model Task`

## Why

A non-recurring task carries a `completed` boolean with no date attached, so
completing it late rewrites the **due** day's score rather than today's.
`completedAt` is already written on every completion and is **never read anywhere**
— the data needed to fix this is already in the table.

## Verify

Complete an overdue task; yesterday's percentage is unchanged and today's rises.
