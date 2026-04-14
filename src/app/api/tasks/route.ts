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

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, description, dueDate, time, endTime, recurringType, recurringDays, recurringEnd, weight } = body

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
    },
    include: { completions: true, skips: true },
  })
  return NextResponse.json(task, { status: 201 })
}
