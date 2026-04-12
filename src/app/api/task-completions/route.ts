import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST { taskId, date } — toggles a recurring task completion for a specific date
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { taskId, date } = body

  if (!taskId || !date) {
    return NextResponse.json({ error: 'taskId and date required' }, { status: 400 })
  }

  const existing = await prisma.taskCompletion.findUnique({
    where: { taskId_date: { taskId, date } },
  })

  if (existing) {
    await prisma.taskCompletion.delete({ where: { id: existing.id } })
    return NextResponse.json({ completed: false })
  } else {
    const completion = await prisma.taskCompletion.create({ data: { taskId, date } })
    return NextResponse.json({ completed: true, completion })
  }
}
