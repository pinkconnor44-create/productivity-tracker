import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const habits = await prisma.habit.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      include: {
        completions: { orderBy: { date: 'desc' }, take: 60 },
        skips: true,
      },
    })
    return NextResponse.json(habits)
  } catch (e) {
    console.error('[/api/habits GET]', e)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, description } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const { recurringDays, weight, startDate } = body

  const habit = await prisma.habit.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      recurringDays: recurringDays || null,
      weight: weight && [1,2,3].includes(weight) ? weight : 1,
      startDate: startDate || null,
    },
    include: { completions: true, skips: true },
  })
  return NextResponse.json(habit, { status: 201 })
}
