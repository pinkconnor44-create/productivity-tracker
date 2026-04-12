import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const weekStart = searchParams.get('weekStart')
  if (!weekStart) return NextResponse.json({ error: 'weekStart required' }, { status: 400 })
  const review = await prisma.weeklyReview.findUnique({ where: { weekStart } })
  return NextResponse.json(review ?? { weekStart, wins: '', lessons: '', focus: '' })
}

export async function POST(req: NextRequest) {
  const { weekStart, wins, lessons, focus } = await req.json()
  const review = await prisma.weeklyReview.upsert({
    where: { weekStart },
    create: { weekStart, wins: wins ?? '', lessons: lessons ?? '', focus: focus ?? '' },
    update: {
      ...(wins     !== undefined && { wins }),
      ...(lessons  !== undefined && { lessons }),
      ...(focus    !== undefined && { focus }),
    },
  })
  return NextResponse.json(review)
}
