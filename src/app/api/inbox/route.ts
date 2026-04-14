import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const items = await prisma.inboxItem.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(items)
  } catch (e) {
    console.error('[/api/inbox GET]', e)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })
    const item = await prisma.inboxItem.create({ data: { text: text.trim() } })
    return NextResponse.json(item)
  } catch (e) {
    console.error('[/api/inbox POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
