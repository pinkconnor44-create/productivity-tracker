import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const items = await prisma.matrixItem.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const { title, quadrant } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (![1, 2, 3, 4].includes(quadrant)) return NextResponse.json({ error: 'invalid quadrant' }, { status: 400 })
  const item = await prisma.matrixItem.create({ data: { title: title.trim(), quadrant } })
  return NextResponse.json(item, { status: 201 })
}
