import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/lifts?date=YYYY-MM-DD  or  ?startDate=...&endDate=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const entries = await prisma.liftEntry.findMany({
    where: date
      ? { date }
      : startDate && endDate
        ? { date: { gte: startDate, lte: endDate } }
        : undefined,
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(entries, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/lifts  { date, name, weight, sets: number[] }
export async function POST(req: NextRequest) {
  const { date, name, weight, sets } = await req.json()
  if (!date || !name || weight == null || !Array.isArray(sets))
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })

  const totalReps = (sets as number[]).reduce((a, b) => a + (b || 0), 0)

  const entry = await prisma.liftEntry.create({
    data: {
      date,
      name: name.trim(),
      weight: parseFloat(weight),
      sets: JSON.stringify(sets),
      totalReps,
    },
  })

  return NextResponse.json(entry)
}
