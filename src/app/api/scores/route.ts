import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isTaskActiveOnDate, isHabitActiveOnDate } from '@/lib/recurring'

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// GET /api/scores?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Returns: { [date]: { completed: number, total: number, pct: number } }
// Each task and habit counts as 1. pct = completed/total * 100.
export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate') ?? '2000-01-01'
  const endDate = searchParams.get('endDate') ?? '2099-12-31'

  // Never compute scores for future dates — only past and today
  const todayStr = addDays(new Date().toISOString().slice(0, 10), 0)
  const actualEnd = endDate > todayStr ? todayStr : endDate

  const [tasks, habits] = await Promise.all([
    prisma.task.findMany({
      // Include soft-deleted tasks so their historical completions still count
      include: {
        completions: {
          where: { date: { gte: startDate, lte: endDate } },
          select: { date: true },
        },
        skips: {
          where: { date: { gte: startDate, lte: endDate } },
          select: { date: true },
        },
      },
    }),
    prisma.habit.findMany({
      where: { active: true },
      include: {
        completions: {
          where: { date: { gte: startDate, lte: endDate } },
          select: { date: true },
        },
        skips: {
          where: { date: { gte: startDate, lte: endDate } },
          select: { date: true },
        },
      },
    }),
  ])

  const scores: Record<string, { completed: number; total: number; pct: number }> = {}

  // Iterate every date in the range
  let current = startDate
  while (current <= actualEnd) {
    const date = current
    let total = 0
    let completed = 0

    for (const task of tasks) {
      // Soft-deleted tasks: only count on dates strictly before their deletion date
      if (!task.active && task.deletedAt && date >= task.deletedAt) continue
      if (isTaskActiveOnDate(task, date)) {
        if (task.skips.some(s => s.date === date)) continue // excused for this day
        const w = task.weight ?? 1
        total += w
        const done = task.recurringType
          ? task.completions.some(c => c.date === date)
          : task.completed
        if (done) completed += w
      }
    }

    for (const habit of habits) {
      if (isHabitActiveOnDate(habit, date)) {
        if (habit.skips.some(s => s.date === date)) continue // excused for this day
        const w = habit.weight ?? 1
        total += w
        if (habit.completions.some(c => c.date === date)) completed += w
      }
    }

    if (total > 0) {
      scores[date] = { completed, total, pct: Math.round((completed / total) * 100) }
    }

    current = addDays(current, 1)
  }

  return NextResponse.json(scores)
  } catch (e) {
    console.error('[/api/scores]', e)
    return NextResponse.json({}, { status: 500 })
  }
}
