import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const row = await prisma.scratchpad.findUnique({ where: { id: 1 } })
    if (!row) return NextResponse.json({ notes: '', checklist: [] })
    return NextResponse.json({ notes: row.notes, checklist: JSON.parse(row.checklist) })
  } catch (e) {
    console.error('[/api/scratchpad GET]', e)
    return NextResponse.json({ notes: '', checklist: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { notes, checklist } = body
    const row = await prisma.scratchpad.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        notes: notes ?? '',
        checklist: JSON.stringify(checklist ?? []),
      },
      update: {
        ...(notes !== undefined && { notes }),
        ...(checklist !== undefined && { checklist: JSON.stringify(checklist) }),
      },
    })
    return NextResponse.json({ notes: row.notes, checklist: JSON.parse(row.checklist) })
  } catch (e) {
    console.error('[/api/scratchpad POST]', e)
    return NextResponse.json({ notes: '', checklist: [] }, { status: 500 })
  }
}
