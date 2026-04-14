import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const items = await prisma.matrixItem.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json(items)
  } catch (e) {
    console.error('[/api/matrix GET]', e)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, quadrant } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
    if (![1, 2, 3, 4].includes(quadrant)) return NextResponse.json({ error: 'invalid quadrant' }, { status: 400 })
    const item = await prisma.matrixItem.create({ data: { title: title.trim(), quadrant } })
    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    console.error('[/api/matrix POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
