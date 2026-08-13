import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      where: { active: true },
      orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      include: { completions: true, skips: true },
    })
    return NextResponse.json(tasks)
  } catch (e) {
    console.error('[/api/tasks GET]', e)
    return NextResponse.json([], { status: 500 })
  }
}

const VALID_KINDS = ['meeting', 'focus', 'personal', 'admin', 'planning'] as const

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, description, dueDate, time, endTime, recurringType, recurringDays, recurringEnd, weight, kind, startDate } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      dueDate: dueDate || null,
      time: time || null,
      endTime: endTime || null,
      recurringType: recurringType || null,
      recurringDays: recurringDays || null,
      recurringEnd: recurringEnd || null,
      weight: weight && [1,2,3].includes(weight) ? weight : 1,
      kind: kind && VALID_KINDS.includes(kind) ? kind : null,
      // Browser-local day from the client (item 24, matches Habit). No
      // server fallback on purpose — the server's UTC day is the wrong
      // boundary for an evening-created task, which was the whole bug.
      startDate: typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null,
    },
    include: { completions: true, skips: true },
  })
  return NextResponse.json(task, { status: 201 })
}
