import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const { name, exercises } = await req.json()

  const group = await prisma.liftGroup.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(exercises !== undefined && { exercises: JSON.stringify(exercises) }),
    },
  })
  return NextResponse.json({ ...group, exercises: JSON.parse(group.exercises) })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.liftGroup.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
