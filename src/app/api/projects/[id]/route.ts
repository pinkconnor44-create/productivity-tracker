import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = body.title
  if (body.notes !== undefined) data.notes = body.notes
  if (body.checklist !== undefined) {
    data.checklist = typeof body.checklist === 'string' ? body.checklist : JSON.stringify(body.checklist)
  }
  if (body.order !== undefined) data.order = body.order
  try {
    const item = await prisma.project.update({ where: { id: Number(id) }, data })
    return NextResponse.json(item)
  } catch (e) {
    console.error('[/api/projects/[id] PATCH]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await prisma.project.delete({ where: { id: Number(id) } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[/api/projects/[id] DELETE]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
