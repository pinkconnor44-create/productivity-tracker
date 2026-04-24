import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const groups = await prisma.liftGroup.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json(
    groups.map(g => ({ ...g, exercises: JSON.parse(g.exercises) })),
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const maxOrder = await prisma.liftGroup.aggregate({ _max: { order: true } })
  const group = await prisma.liftGroup.create({
    data: { name: name.trim(), exercises: '[]', order: (maxOrder._max.order ?? 0) + 1 },
  })
  return NextResponse.json({ ...group, exercises: [] })
}
