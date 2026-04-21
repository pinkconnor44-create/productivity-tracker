import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/notes?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Returns { [date]: content }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const notes = await prisma.dayNote.findMany({
    where: startDate && endDate
      ? { date: { gte: startDate, lte: endDate } }
      : undefined,
  })

  const map: Record<string, string> = {}
  for (const n of notes) map[n.date] = n.content
  return NextResponse.json(map, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/notes { date, content }
// If content is empty, deletes the note. Otherwise upserts.
export async function POST(req: NextRequest) {
  const { date, content } = await req.json()
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  if (!content?.trim()) {
    await prisma.dayNote.deleteMany({ where: { date } })
    return NextResponse.json({ deleted: true })
  }

  const note = await prisma.dayNote.upsert({
    where: { date },
    create: { date, content: content.trim() },
    update: { content: content.trim() },
  })
  return NextResponse.json(note)
}
