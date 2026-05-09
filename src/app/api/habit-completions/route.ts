import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/habit-completions { habitId, date } — toggles completion on/off
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
