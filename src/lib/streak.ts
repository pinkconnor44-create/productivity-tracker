// The ONE streak walk over /api/scores data. Shell's TodayWidget, the mobile
// header chip and StatsView all render from here — they used to carry two
// diverging walks and showed "current 47" beside "longest 26" on the same
// screen (item 03).
//
// What an absent day means, decided once: /api/scores only writes a key when
// total > 0, so an absent day is UNSCHEDULED — nothing was asked of the day,
// so it neither extends nor breaks a streak. A streak may step over up to
// MAX_GAP consecutive unscheduled days. A day that IS present with
// completed === 0 was scheduled and missed: it breaks the streak. Both the
// current and the longest walk apply the same rule, so current ≤ longest
// always holds on identical input.

export type DayScore = { completed: number; total: number; pct: number }
export type ScoreData = Record<string, DayScore>

/** Unscheduled days a streak may step over before it is considered broken. */
const MAX_GAP = 7

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(s: string, n: number): string {
  const d = new Date(s + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Days of the streak ending today (or yesterday, when today has no
 *  completion yet — an unfinished today must not read as a broken streak). */
export function calcCurrentStreak(scores: ScoreData, today: string = localToday()): number {
  let check = scores[today]?.completed > 0 ? today : addDays(today, -1)
  let streak = 0, emptyRun = 0
  for (let i = 0; i < 400; i++) {
    const s = scores[check]
    if (!s) {
      emptyRun++
      if (emptyRun > MAX_GAP) break
      check = addDays(check, -1)
      continue
    }
    emptyRun = 0
    if (s.completed === 0) break
    streak++
    check = addDays(check, -1)
  }
  return streak
}

/** Longest streak anywhere in the data, under the same gap rule. */
export function calcLongestStreak(scores: ScoreData): number {
  const dates = Object.keys(scores).filter(d => scores[d].completed > 0).sort()
  let longest = 0, cur = 0, prev: string | null = null
  for (const d of dates) {
    if (prev == null) {
      cur = 1
    } else {
      // Walk the days strictly between the previous kept day and this one:
      // unscheduled (absent) days are stepped over up to MAX_GAP; a present
      // day here necessarily has completed === 0 and breaks the run.
      let gap = 0, x = addDays(prev, 1), broken = false
      while (x !== d) {
        if (scores[x] != null || ++gap > MAX_GAP) { broken = true; break }
        x = addDays(x, 1)
      }
      cur = broken ? 1 : cur + 1
    }
    if (cur > longest) longest = cur
    prev = d
  }
  return longest
}
