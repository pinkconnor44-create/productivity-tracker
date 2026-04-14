import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  const body = await req.json()
  const { name, description, recurringDays, weight } = body

  const habit = await prisma.habit.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(recurringDays !== undefined && { recurringDays: recurringDays || null }),
      ...(weight !== undefined && { weight: [1,2,3].includes(weight) ? weight : 1 }),
    },
    include: { completions: { orderBy: { date: 'desc' }, take: 60 } },
  })
  return NextResponse.json(habit)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  await prisma.habit.update({
    where: { id },
    data: { active: false },
  })
  return NextResponse.json({ success: true })
}
