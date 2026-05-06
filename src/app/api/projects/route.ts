import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const items = await prisma.project.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] })
    return NextResponse.json(items)
  } catch (e) {
    console.error('[/api/projects GET]', e)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
    const max = await prisma.project.aggregate({ _max: { order: true } })
    const item = await prisma.project.create({
      data: { title: title.trim(), order: (max._max.order ?? 0) + 1 },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    console.error('[/api/projects POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
