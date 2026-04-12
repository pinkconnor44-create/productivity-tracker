import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/habit-completions?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const completions = await prisma.habitCompletion.findMany({
    where: {
      ...(startDate && endDate
        ? { date: { gte: startDate, lte: endDate } }
        : {}),
    },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(completions)
}

// POST /api/habit-completions { habitId, date }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { habitId, date } = body

  if (!habitId || !date) {
    return NextResponse.json({ error: 'habitId and date required' }, { status: 400 })
  }

  // Toggle: if exists, delete it; if not, create it
  const existing = await prisma.habitCompletion.findUnique({
    where: { habitId_date: { habitId, date } },
  })

  if (existing) {
    await prisma.habitCompletion.delete({ where: { id: existing.id } })
    return NextResponse.json({ completed: false })
  } else {
    const completion = await prisma.habitCompletion.create({
      data: { habitId, date },
    })
    return NextResponse.json({ completed: true, completion })
  }
}
