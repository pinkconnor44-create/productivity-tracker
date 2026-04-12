import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST { habitId, date } — toggles skip on/off
export async function POST(req: NextRequest) {
  const { habitId, date } = await req.json()
  const existing = await prisma.habitSkip.findUnique({ where: { habitId_date: { habitId, date } } })
  if (existing) {
    await prisma.habitSkip.delete({ where: { id: existing.id } })
    return NextResponse.json({ skipped: false })
  }
  await prisma.habitSkip.create({ data: { habitId, date } })
  return NextResponse.json({ skipped: true })
}
