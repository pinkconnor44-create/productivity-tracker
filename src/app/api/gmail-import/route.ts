import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  // Check secret key
  const key = req.headers.get('x-api-key')
  if (!key || key !== process.env.GMAIL_IMPORT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { title, description, dueDate, time } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      dueDate: dueDate || null,
      time: time || null,
      endTime: null,
      recurringType: null,
      recurringDays: null,
      recurringEnd: null,
      weight: 1,
    },
    include: { completions: true, skips: true },
  })

  return NextResponse.json(task, { status: 201 })
}
